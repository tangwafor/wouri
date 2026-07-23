import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { enqueue, sync, all, type Capture } from '../lib/queue';

const COMMODITIES = ['cocoa', 'coffee', 'palm_oil', 'rubber', 'cotton', 'banana', 'timber'];

// A tiny v4 uuid (client-minted ids; collisions are negligible for this use).
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// The harvest capture: plot, GPS, photo. Saved to the on-device queue and synced
// to the custody chain when online. No em-dashes.
export default function CaptureScreen() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [commodity, setCommodity] = useState('cocoa');
  const [lotCode, setLotCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [plotCode, setPlotCode] = useState('');
  const [area, setArea] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [list, setList] = useState<Capture[]>([]);
  const [msg, setMsg] = useState('');

  async function refresh() { setList(await all()); }
  useEffect(() => {
    supabase.from('organizations').select('id').limit(1).then(({ data }) => setOrgId(data?.[0]?.id ?? null));
    refresh();
  }, []);

  async function getLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setMsg('Location permission denied'); return; }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
  }
  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setMsg('Camera permission denied'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  }

  async function save() {
    if (!orgId || !lotCode) { setMsg('Sign in and enter a lot code'); return; }
    const c: Capture = {
      id: uuid(), event_id: uuid(), org_id: orgId, commodity_key: commodity,
      lot_code: lotCode, quantity_kg: quantity ? Number(quantity) : 0,
      plot_code: plotCode || lotCode + '-plot', area_ha: area ? Number(area) : null,
      lat: coords?.lat ?? null, lon: coords?.lon ?? null, photo_uri: photo,
      created_at: new Date().toISOString(), synced: false,
    };
    await enqueue(c);
    setLotCode(''); setQuantity(''); setPlotCode(''); setArea(''); setCoords(null); setPhoto(null);
    setMsg('Saved on device. Sync when online.');
    refresh();
  }
  async function doSync() {
    setMsg('Syncing...');
    const { ok, failed } = await sync();
    setMsg('Synced ' + ok + ', ' + (failed ? failed + ' failed (still queued)' : 'all done'));
    refresh();
  }

  const pending = list.filter((c) => !c.synced).length;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 20 }}>
      <Text style={s.h}>Record a harvest</Text>

      <Text style={s.label}>Commodity</Text>
      <View style={s.chips}>
        {COMMODITIES.map((k) => (
          <Pressable key={k} onPress={() => setCommodity(k)} style={[s.chip, commodity === k && s.chipOn]}>
            <Text style={[s.chipText, commodity === k && s.chipTextOn]}>{k}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Lot code</Text>
      <TextInput style={s.input} value={lotCode} onChangeText={setLotCode} placeholder="LOT-2026-001" />
      <Text style={s.label}>Quantity (kg)</Text>
      <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
      <Text style={s.label}>Plot code</Text>
      <TextInput style={s.input} value={plotCode} onChangeText={setPlotCode} />
      <Text style={s.label}>Area (ha)</Text>
      <TextInput style={s.input} value={area} onChangeText={setArea} keyboardType="decimal-pad" />

      <View style={s.row}>
        <Pressable style={s.ghost} onPress={getLocation}><Text style={s.ghostText}>{coords ? 'Location set' : 'Capture GPS'}</Text></Pressable>
        <Pressable style={s.ghost} onPress={takePhoto}><Text style={s.ghostText}>{photo ? 'Photo set' : 'Take photo'}</Text></Pressable>
      </View>
      {coords ? <Text style={s.meta}>{coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}</Text> : null}
      {photo ? <Image source={{ uri: photo }} style={s.preview} /> : null}

      <Pressable style={s.btn} onPress={save}><Text style={s.btnText}>Save harvest</Text></Pressable>

      <View style={s.syncbar}>
        <Text style={s.meta}>{pending} pending</Text>
        <Pressable style={[s.ghost, { marginTop: 0 }]} onPress={doSync}><Text style={s.ghostText}>Sync now</Text></Pressable>
      </View>
      {msg ? <Text style={s.meta}>{msg}</Text> : null}

      {list.map((c) => (
        <View key={c.id} style={s.item}>
          <Text style={{ fontWeight: '600', color: '#14120d' }}>{c.lot_code} <Text style={{ color: '#857d6c', fontWeight: '400' }}>{c.commodity_key}</Text></Text>
          <Text style={[s.meta, { color: c.synced ? '#0a635a' : '#a9762a' }]}>{c.synced ? 'synced' : 'queued'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f1ea' },
  h: { fontSize: 22, fontWeight: '700', color: '#0d4f47', marginBottom: 8 },
  label: { fontSize: 13, color: '#443f34', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2ded1', borderRadius: 9, padding: 12, backgroundColor: '#fffefb', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#e2ded1', borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fffefb' },
  chipOn: { backgroundColor: '#0d4f47', borderColor: '#0d4f47' },
  chipText: { color: '#443f34' }, chipTextOn: { color: '#f6f4ee' },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ghost: { flex: 1, borderWidth: 1, borderColor: '#0d4f47', borderRadius: 9, padding: 12, alignItems: 'center', marginTop: 8 },
  ghostText: { color: '#0a635a', fontWeight: '600' },
  meta: { color: '#857d6c', fontSize: 13, marginTop: 8 },
  preview: { width: '100%', height: 160, borderRadius: 10, marginTop: 10 },
  btn: { backgroundColor: '#0d4f47', borderRadius: 9, padding: 14, alignItems: 'center', marginTop: 18 },
  btnText: { color: '#f6f4ee', fontWeight: '700', fontSize: 16 },
  syncbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e2ded1' },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2ded1' },
});
