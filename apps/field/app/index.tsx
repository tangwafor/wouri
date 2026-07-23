import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

// Sign in. If a session is already stored (offline-persisted), go straight to
// capture. No em-dashes.
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace('/capture'); });
  }, []);

  async function signIn() {
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.replace('/capture');
  }

  return (
    <View style={s.wrap}>
      <Text style={s.brand}>Wouri Field</Text>
      <Text style={s.tag}>Capture the harvest, even with no signal.</Text>
      <Text style={s.label}>Email</Text>
      <TextInput style={s.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Text style={s.label}>Password</Text>
      <TextInput style={s.input} secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={[s.btn, busy && s.btnDisabled]} disabled={busy} onPress={signIn}>
        <Text style={s.btnText}>{busy ? 'Signing in' : 'Sign in'}</Text>
      </Pressable>
      {err ? <Text style={s.err}>{err}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f4f1ea' },
  brand: { fontSize: 30, fontWeight: '700', color: '#0d4f47' },
  tag: { color: '#443f34', marginBottom: 22 },
  label: { fontSize: 13, color: '#443f34', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2ded1', borderRadius: 9, padding: 12, backgroundColor: '#fffefb', fontSize: 16 },
  btn: { backgroundColor: '#0d4f47', borderRadius: 9, padding: 14, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#f6f4ee', fontWeight: '700', fontSize: 16 },
  err: { color: '#a11f1c', marginTop: 12 },
});
