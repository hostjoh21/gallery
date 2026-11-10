// Inalinganisha folder ya Google Drive na R2 + Supabase.
// Inaendeshwa na GitHub Actions (au kwa mkono: npm run sync).

import { google } from 'googleapis';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createClient } from '@supabase/supabase-js';

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Env variable inakosekana: ${name}`);
  return v;
}

const folderId = env('DRIVE_FOLDER_ID');
const bucket = env('R2_BUCKET');
const publicUrl = env('R2_PUBLIC_URL').replace(/\/+$/, '');

const drive = google.drive({
  version: 'v3',
  auth: new google.auth.GoogleAuth({
    credentials: JSON.parse(env('GOOGLE_SERVICE_ACCOUNT_JSON')),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  }),
});

const r2 = new S3Client({
  region: process.env.S3_REGION || 'auto',
  // Kwa R2 inatosha R2_ACCOUNT_ID. Kwa huduma nyingine (Tigris, Backblaze B2) weka S3_ENDPOINT na S3_REGION.
  endpoint:
    process.env.S3_ENDPOINT || `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  },
  // R2 haihitaji checksums za ziada za SDK mpya
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const FOLDER_MIME = 'application/vnd.google-apps.folder';

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

// "01 Harusi", "1. Harusi", "01-Harusi" -> "Harusi" (namba za mwanzo zinatumika kupanga tu)
function albumName(name) {
  const n = name.replace(/^\d{1,3}\s*[-_.)]\s*|^\d{1,3}\s+/, '').trim();
  return n || name;
}

async function listChildren(parentId) {
  const out = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false and (mimeType = '${FOLDER_MIME}' or mimeType contains 'image/' or mimeType contains 'video/')`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, createdTime)',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    out.push(...res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return out;
}

// Kila sub-folder ya kwanza ndani ya folder kuu ni "album". Mpangilio wa albamu na wa files ni kwa jina (namba zinahesabiwa: 2 kabla ya 10).
async function listDriveFiles() {
  const files = [];
  const seen = new Set([folderId]);

  const top = await listChildren(folderId);
  const albums = top.filter((c) => c.mimeType === FOLDER_MIME).sort(byName);

  for (const f of top.filter((c) => c.mimeType !== FOLDER_MIME)) {
    files.push({ ...f, album: null, albumOrder: 0 });
  }

  for (const [i, album] of albums.entries()) {
    const queue = [album.id];
    seen.add(album.id);
    while (queue.length > 0) {
      for (const c of await listChildren(queue.shift())) {
        if (c.mimeType === FOLDER_MIME) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            queue.push(c.id);
          }
        } else {
          files.push({ ...c, album: albumName(album.name), albumOrder: i + 1 });
        }
      }
    }
  }

  files.sort((x, y) => x.albumOrder - y.albumOrder || byName(x, y));
  files.forEach((f, i) => { f.sortOrder = i; });
  return files;
}

function extensionOf(file) {
  const fromName = file.name.match(/\.([A-Za-z0-9]+)$/)?.[1];
  return (fromName || file.mimeType.split('/')[1] || 'bin').toLowerCase();
}

function titleOf(file) {
  return file.name.replace(/\.[A-Za-z0-9]+$/, '');
}

async function uploadToR2(file, key) {
  const res = await drive.files.get(
    { fileId: file.id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  await new Upload({
    client: r2,
    params: {
      Bucket: bucket,
      Key: key,
      Body: res.data,
      ContentType: file.mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
  }).done();
}

async function deleteFromR2(key) {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function main() {
  const driveFiles = await listDriveFiles();
  console.log(`Drive: faili ${driveFiles.length}`);

  const { data: rows, error } = await supabase.from('media').select('*');
  if (error) throw new Error(`Supabase: ${error.message}`);
  const byDriveId = new Map(rows.map((r) => [r.drive_id, r]));

  let added = 0, updated = 0, removed = 0, failed = 0;

  // 1. Mpya na zilizobadilishwa
  for (const f of driveFiles) {
    if (!f.md5Checksum) continue;
    const existing = byDriveId.get(f.id);
    const meta = {
      title: titleOf(f),
      album: f.album,
      album_order: f.albumOrder,
      sort_order: f.sortOrder,
    };

    if (existing && existing.md5 === f.md5Checksum) {
      // Maudhui hayajabadilika; sasisha jina/albamu/mpangilio tu kama vimebadilika
      if (Object.entries(meta).some(([k, v]) => existing[k] !== v)) {
        const { error: metaErr } = await supabase.from('media').update(meta).eq('drive_id', f.id);
        if (metaErr) console.error(`Kusasisha mpangilio kumeshindwa (${f.name}): ${metaErr.message}`);
      }
      continue;
    }

    try {
      // Key ina md5 ndani yake: file ikibadilika, URL pia inabadilika (hakuna cache ya zamani)
      const key = `${f.id}-${f.md5Checksum.slice(0, 8)}.${extensionOf(f)}`;
      console.log(`${existing ? 'Kusasisha' : 'Kuongeza'}: ${f.name}`);
      await uploadToR2(f, key);

      const { error: upErr } = await supabase.from('media').upsert(
        {
          drive_id: f.id,
          ...meta,
          type: f.mimeType.startsWith('video/') ? 'video' : 'image',
          url: `${publicUrl}/${key}`,
          r2_key: key,
          md5: f.md5Checksum,
          drive_created: f.createdTime,
        },
        { onConflict: 'drive_id' }
      );
      if (upErr) throw new Error(upErr.message);

      if (existing && existing.r2_key !== key) await deleteFromR2(existing.r2_key);
      existing ? updated++ : added++;
    } catch (e) {
      failed++;
      console.error(`Imeshindwa (${f.name}): ${e.message}`);
    }
  }

  // 2. Zilizofutwa Drive
  const driveIds = new Set(driveFiles.map((f) => f.id));
  const gone = rows.filter((r) => !driveIds.has(r.drive_id));

  if (gone.length > 0 && driveFiles.length === 0 && !process.env.ALLOW_EMPTY) {
    console.warn(
      'Drive imerudisha folder tupu lakini database ina vitu. Sifuti kitu (kinga dhidi ya hitilafu). ' +
        'Kama umefuta kila kitu kwa makusudi, weka ALLOW_EMPTY=1.'
    );
  } else {
    for (const r of gone) {
      try {
        console.log(`Kufuta: ${r.title}`);
        await deleteFromR2(r.r2_key);
        const { error: delErr } = await supabase.from('media').delete().eq('drive_id', r.drive_id);
        if (delErr) throw new Error(delErr.message);
        removed++;
      } catch (e) {
        failed++;
        console.error(`Kufuta kumeshindwa (${r.title}): ${e.message}`);
      }
    }
  }

  console.log(`Imekamilika: +${added} mpya, ~${updated} zimebadilishwa, -${removed} zimefutwa, ${failed} zimeshindwa`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
