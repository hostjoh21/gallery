import './globals.css';

const title = process.env.NEXT_PUBLIC_SITE_TITLE || 'Gallery';

export const metadata = {
  title,
  description: `Picha na video: ${title}`,
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="sw">
      <body>{children}</body>
    </html>
  );
}
