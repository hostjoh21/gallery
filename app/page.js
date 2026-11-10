import Gallery from './Gallery';
import { getMedia } from '../lib/media';

// Ukurasa unajisasisha wenyewe kila sekunde 60
export const revalidate = 60;

export default async function Home() {
  const items = await getMedia();
  const title = process.env.NEXT_PUBLIC_SITE_TITLE || 'Gallery';

  return (
    <main className="page">
      <header className="top">
        <h1>{title}</h1>
        <p className="count">
          {items.length === 0 ? 'Bado hakuna kitu' : `${items.length} vitu`}
        </p>
      </header>
      <Gallery items={items} />
    </main>
  );
}
