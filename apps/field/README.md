# Wouri Field (Expo)

The offline field app: a field agent captures the harvest under a tree with no
signal, and it syncs to the custody chain later. Same Supabase, same
`create_lot_at_origin` RPC the console uses. House style: no em-dashes.

## What it does

- **Sign in** (Supabase auth, session persisted in AsyncStorage, so you stay
  signed in offline).
- **Record a harvest**: commodity, lot code, quantity, plot code, area, the **GPS
  location** (expo-location), and a **photo** (expo-image-picker).
- **Queue offline**: every capture is stored on the device with client-minted ids.
- **Sync**: when online, `lib/queue.ts` pushes each pending capture to
  `create_lot_at_origin`, creating the origin unit (with the GPS point as
  geometry), the lot, and the harvest event. A synced capture is never re-sent.

## Status

This is a wired scaffold. It is **not built or run on the Windows dev box**, because
React Native and Expo build in the cloud (EAS) or on a device, not here. To run it:

```
cd apps/field
npm install
npx expo start          # then open in Expo Go or a dev build
# or a real build:
npx eas build -p android --profile preview
```

Set the Supabase anon key: replace `SET_AT_BUILD` in `app.json` under
`expo.extra.supabaseAnonKey` (the URL is already the dev project), or wire it
through EAS secrets.

## Follow-ons

- **Photo upload.** Photos are kept locally for now; a real build uploads them to
  Supabase storage and attaches the reference as origin evidence.
- **Boundary walk.** GPS is captured as a single Point (the plot centroid). Walking
  the plot boundary to record a full EUDR polygon is the next capture mode; the
  data model already stores polygons.
- **Background sync** on connectivity change.

## Why it matters

The custody chain must start at the source. The console covers the office; this app
covers the plot, so the harvest event and the plot geolocation are recorded where
they happen, then flow into the same tamper-evident chain the whole registry is
built on.
