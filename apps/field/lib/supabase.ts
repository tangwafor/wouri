import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// The Supabase client for the field app. The session persists in AsyncStorage so
// a field agent stays signed in offline. No em-dashes.
const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl: string; supabaseAnonKey: string };

export const supabase = createClient(extra.supabaseUrl, extra.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
