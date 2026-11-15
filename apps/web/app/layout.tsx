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
      <body suppressHydrationWarning className="min-h-screen bg-obsidian-void text-warm-bone antialiased selection:bg-cyan-500/20 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
