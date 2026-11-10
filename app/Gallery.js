'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Photos' },
  { id: 'video', label: 'Videos' },
];

// Values baked at build time (used only if config.json is not filled in)
const ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  title: process.env.NEXT_PUBLIC_SITE_TITLE || '',
};

// config.json sits next to index.html, so it can be edited on the server without rebuilding.
async function loadConfig() {
  let file = {};
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (res.ok) file = await res.json();
  } catch {
    // no config.json: fall back to build-time values
  }
  const usable = (v) => typeof v === 'string' && v.trim() !== '' && !v.includes('YOUR-');
  return {
    supabaseUrl: (usable(file.supabaseUrl) ? file.supabaseUrl : ENV.supabaseUrl).trim().replace(/\/+$/, ''),
    anonKey: (usable(file.anonKey) ? file.anonKey : ENV.anonKey).trim(),
    title: (typeof file.title === 'string' && file.title.trim()) || ENV.title || 'Gallery',
  };
}

async function fetchMedia({ supabaseUrl, anonKey }) {
  if (!supabaseUrl || !anonKey) throw new Error('config');
  const all = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url =
      `${supabaseUrl}/rest/v1/media?select=id,title,url,type,album` +
      `&order=album_order.asc,sort_order.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export default function Gallery() {
  const [state, setState] = useState({ status: 'loading', items: [], title: '' });
  const [filter, setFilter] = useState('all');
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await loadConfig();
      if (!cancelled) document.title = config.title;
      try {
        const items = await fetchMedia(config);
        if (!cancelled) setState({ status: 'ready', items, title: config.title });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: e.message === 'config' ? 'noconfig' : 'error',
            items: [],
            title: config.title,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = state.items;

  // Items arrive already ordered (albums in order, then files). We only split them by album.
  const groups = useMemo(() => {
    const shown = filter === 'all' ? items : items.filter((i) => i.type === filter);
    const map = new Map();
    for (const item of shown) {
      const key = item.album || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    let start = 0;
    return [...map.entries()].map(([name, list]) => {
      const group = { name, list, start };
      start += list.length;
      return group;
    });
  }, [items, filter]);

  const flat = useMemo(() => groups.flatMap((g) => g.list), [groups]);

  const hasBoth =
    items.some((i) => i.type === 'image') && items.some((i) => i.type === 'video');
  const namedGroups = groups.filter((g) => g.name);

  const close = useCallback(() => setOpenIndex(null), []);
  const move = useCallback(
    (step) =>
      setOpenIndex((i) => (i === null ? i : (i + step + flat.length) % flat.length)),
    [flat.length]
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openIndex, close, move]);

  if (state.status === 'loading') return <p className="empty">Loading…</p>;

  if (state.status === 'noconfig') {
    return (
      <p className="empty">
        Setup needed: open <b>config.json</b> on the server and fill in your Supabase URL and anon key.
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <p className="empty">
        Could not load the gallery. Please try again in a moment. If this keeps happening, check
        the values in config.json.
      </p>
    );
  }

  const current = openIndex === null ? null : flat[openIndex];

  return (
    <>
      <header className="top">
        <h1>{state.title}</h1>
        <p className="count">
          {items.length === 0 ? 'Nothing here yet' : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
        </p>
      </header>

      {items.length === 0 && (
        <p className="empty">
          Add photos or videos to the Drive folder and they will appear here after the next sync.
        </p>
      )}

      {hasBoth && (
        <div className="filters" role="tablist" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={filter === f.id ? 'chip on' : 'chip'}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {namedGroups.length > 1 && (
        <nav className="jump" aria-label="Albums">
          {namedGroups.map((g) => (
            <a key={g.name} href={`#album-${groups.indexOf(g)}`}>
              {g.name}
            </a>
          ))}
        </nav>
      )}

      {groups.map((group, gi) => (
        <section key={group.name || 'main'} id={`album-${gi}`} className="album">
          {group.name && (
            <h2>
              {group.name} <span>{group.list.length}</span>
            </h2>
          )}
          <ul className="grid">
            {group.list.map((item, i) => (
              <li key={item.id}>
                <button
                  className="tile"
                  onClick={() => setOpenIndex(group.start + i)}
                  aria-label={item.title || (item.type === 'video' ? 'Video' : 'Photo')}
                >
                  {item.type === 'video' ? (
                    <>
                      <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline />
                      <span className="play" aria-hidden="true" />
                    </>
                  ) : (
                    <img src={item.url} alt={item.title || ''} loading="lazy" decoding="async" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {current && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={close}>
          <button className="lb-btn lb-close" onClick={close} aria-label="Close">
            ×
          </button>
          {flat.length > 1 && (
            <>
              <button
                className="lb-btn lb-prev"
                onClick={(e) => { e.stopPropagation(); move(-1); }}
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                className="lb-btn lb-next"
                onClick={(e) => { e.stopPropagation(); move(1); }}
                aria-label="Next"
              >
                ›
              </button>
            </>
          )}
          <div className="stage" onClick={(e) => e.stopPropagation()}>
            {current.type === 'video' ? (
              <video key={current.id} src={current.url} controls autoPlay playsInline />
            ) : (
              <img key={current.id} src={current.url} alt={current.title || ''} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
