import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuoteFollow — Never Lose a Quote Again',
  description:
    'Forward your quotes to your own follow-up inbox. QuoteFollow chases every quote for you — day 1, 3, and 7 — and tells you when a customer is hot.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
