import { createClient } from '@supabase/supabase-js';

export async function getMedia() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('media')
    .select('id, title, url, type, album')
    .order('album_order', { ascending: true })
    .order('sort_order', { ascending: true })
    .limit(1000);

  if (error) throw new Error(`Supabase: ${error.message}`);
  return data;
}
