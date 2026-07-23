import { cookies } from 'next/headers';
import { t, DEFAULT_LOCALE, type Locale, type Key } from './i18n';

// The chosen UI language, from the `locale` cookie the switcher sets. French is
// the default (Cameroon first). Server components read it and bind a translator
// so every string renders in the chosen language, no browser auto-translation.
// No em-dashes.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get('locale')?.value;
  return v === 'en' || v === 'fr' ? v : DEFAULT_LOCALE;
}

// A translator bound to the current locale: getT() then tt('key').
export async function getT(): Promise<{ locale: Locale; tt: (k: Key) => string }> {
  const locale = await getLocale();
  return { locale, tt: (k: Key) => t(k, locale) };
}
