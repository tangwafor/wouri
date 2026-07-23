import type { Metadata } from 'next';
import './globals.css';
import { getLocale } from '@/lib/locale';
import { LocaleSwitcher } from './LocaleSwitcher';

export const metadata: Metadata = {
  title: 'Wouri',
  description: 'The trust and credit layer for African commodity export.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleSwitcher current={locale} />
        {children}
      </body>
    </html>
  );
}
