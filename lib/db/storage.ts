import { supabaseAdmin } from './supabase';
import { supabaseConfig } from '@/lib/env';

const BUCKET = 'connection-images';

/**
 * Supabase Storage helpers for the connection-images bucket.
 * All calls use the service-role client (bypasses RLS).
 */
export const storageHelpers = {
  /** Bucket name. */
  bucket: BUCKET,

  /**
   * Build the public URL for an object key in connection-images.
   * Used for Neo4j edge `imageUrl` properties.
   */
  publicUrl(key: string): string {
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
    return data.publicUrl;
  },

  /** Extract the storage object key from a full public URL we wrote. */
  keyFromPublicUrl(url: string): string | null {
    if (!supabaseConfig.url) return null;
    const prefix = `${supabaseConfig.url}/storage/v1/object/public/${BUCKET}/`;
    return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
  },

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, body, { contentType, upsert: true });
    if (error) throw new Error(`storage.upload: ${error.message}`);
  },

  async remove(key: string): Promise<void> {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([key]);
    if (error) throw new Error(`storage.remove: ${error.message}`);
  },

  /**
   * List object names (just the keys) under an optional prefix.
   * Pages through results because Supabase caps at 1000 per call.
   */
  async listKeys(prefix = ''): Promise<string[]> {
    const PAGE = 1000;
    const out: string[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(prefix, { limit: PAGE, offset });
      if (error) throw new Error(`storage.list: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const item of data) {
        if (item.name) out.push(prefix ? `${prefix}/${item.name}` : item.name);
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return out;
  },
};
