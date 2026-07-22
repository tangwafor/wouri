import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wouri',
  description: 'The trust and credit layer for African commodity export.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
