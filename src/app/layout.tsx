import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DataPulse — Operational Intelligence',
  description: 'Interactive operational intelligence console with anomaly detection and Cascade Replay',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dp-bg text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
