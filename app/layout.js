import './globals.css';

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_TITLE || 'Gallery',
  description: 'Photos and videos',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
