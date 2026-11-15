import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShareLAN — High-Performance LAN File Transfer',
  description:
    'AirDrop-speed streaming file transfer for laptops and computers on local networks with SHA-256 integrity and zero cloud storage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body suppressHydrationWarning className="min-h-screen bg-background text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
