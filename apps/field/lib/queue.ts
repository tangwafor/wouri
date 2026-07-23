import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// The offline harvest queue. A field agent captures under a tree with no signal;
// the capture is stored on the device and synced to the custody chain later, via
// the same create_lot_at_origin RPC the console uses. Client-minted ids keep it
// idempotent; a synced capture is never re-sent. Photos are kept locally for now
// (uploading to storage is a follow-on). No em-dashes.

const KEY = 'wouri_field_queue';

export type Capture = {
  id: string;            // client-minted lot id
  event_id: string;      // client-minted harvest event id
  org_id: string;
  commodity_key: string;
  lot_code: string;
  quantity_kg: number;
  plot_code: string;
  area_ha: number | null;
  lat: number | null;
  lon: number | null;
  photo_uri: string | null;
  created_at: string;
  synced: boolean;
};

async function read(): Promise<Capture[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Capture[]) : [];
}
async function write(list: Capture[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function enqueue(c: Capture) {
  const list = await read();
  list.unshift(c);
  await write(list);
}
export async function all() {
  return read();
}
export async function pendingCount() {
  return (await read()).filter((c) => !c.synced).length;
}

function pointGeoJSON(lat: number | null, lon: number | null) {
  return lat != null && lon != null ? { type: 'Point', coordinates: [lon, lat] } : null;
}

// Push every pending capture to the custody chain. Returns how many synced and
// how many failed (stay queued for the next attempt).
export async function sync(): Promise<{ ok: number; failed: number }> {
  const list = await read();
  let ok = 0, failed = 0;
  for (const c of list) {
    if (c.synced) continue;
    const { error } = await supabase.rpc('create_lot_at_origin', {
      p_org: c.org_id, p_lot_id: c.id, p_commodity_key: c.commodity_key, p_lot_code: c.lot_code,
      p_quantity_kg: c.quantity_kg, p_claim: 'segregated', p_is_cites: false,
      p_plot_code: c.plot_code, p_plot_kind: 'plot', p_area_ha: c.area_ha,
      p_geometry: pointGeoJSON(c.lat, c.lon), p_event_id: c.event_id,
    });
    if (error) { failed += 1; } else { c.synced = true; ok += 1; }
  }
  await write(list);
  return { ok, failed };
}
