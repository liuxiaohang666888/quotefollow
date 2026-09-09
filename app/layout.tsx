import type { Metadata } from 'next';
import './globals.css';
import { getBrandName, getVerticalConfig } from '@/lib/vertical';

export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrandName();
  const config = getVerticalConfig();
  return {
    title: `${brand} — Never Lose a ${config.customerLabel} Again`,
    description: `AI-powered quote follow-up for ${config.audience}. Automatically chases your quotes via email so you close more jobs.`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="_VlvkTfQuBDJW-tNe6RIHunGL_d1oKZ7kZdc-Fn8wMA" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}