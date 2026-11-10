'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const FILTERS = [
  { id: 'all', label: 'Zote' },
  { id: 'image', label: 'Picha' },
  { id: 'video', label: 'Video' },
];

export default function Gallery({ items }) {
  const [filter, setFilter] = useState('all');
  const [openIndex, setOpenIndex] = useState(null);

  // Vitu vinafika vimepangwa tayari (albamu kwa mpangilio, kisha files). Tunavigawa tu kwa albamu.
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

  if (items.length === 0) {
    return (
      <p className="empty">
        Weka picha au video kwenye folder ya Drive. Zitaonekana hapa baada ya sync inayofuata.
      </p>
    );
  }

  const current = openIndex === null ? null : flat[openIndex];

  return (
    <>
      {hasBoth && (
        <div className="filters" role="tablist" aria-label="Chuja">
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
        <nav className="jump" aria-label="Albamu">
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
                  aria-label={item.title || (item.type === 'video' ? 'Video' : 'Picha')}
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
          <button className="lb-btn lb-close" onClick={close} aria-label="Funga">
            ×
          </button>
          {flat.length > 1 && (
            <>
              <button
                className="lb-btn lb-prev"
                onClick={(e) => { e.stopPropagation(); move(-1); }}
                aria-label="Iliyotangulia"
              >
                ‹
              </button>
              <button
                className="lb-btn lb-next"
                onClick={(e) => { e.stopPropagation(); move(1); }}
                aria-label="Inayofuata"
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
