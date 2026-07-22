// Supabase server client (Next 15 App Router, @supabase/ssr). RLS is the single gate,
// so this client always runs under the user session. No em-dashes.
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component; the middleware refreshes the session instead
          }
        },
      },
    },
  );
}
