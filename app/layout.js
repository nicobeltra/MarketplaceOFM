import './globals.css';

export const metadata = {
  title: 'OFM Marketplace — Command Center',
  description: 'Marketplace management system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
