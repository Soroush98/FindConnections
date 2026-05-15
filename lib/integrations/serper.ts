import { serperConfig } from '@/lib/env';
import { AppError } from '@/lib/errors';

const SERPER_IMAGES_URL = 'https://google.serper.dev/images';

export interface SerperImage {
  /** Direct image URL */
  imageUrl: string;
  /** Page the image is hosted on */
  link?: string;
  /** Source domain */
  source?: string;
  /** Title from the host page */
  title?: string;
  width?: number;
  height?: number;
}

interface SerperResponse {
  images?: Array<{
    imageUrl: string;
    link?: string;
    source?: string;
    title?: string;
    imageWidth?: number;
    imageHeight?: number;
  }>;
}

/**
 * Search Google image results via Serper. Returns up to `count` image hits
 * for the query. Caller is responsible for downloading + validating each one.
 */
export async function searchImages(query: string, count: number): Promise<SerperImage[]> {
  if (!serperConfig.apiKey) {
    throw AppError.validation('SERPER_API_KEY is not configured');
  }

  const res = await fetch(SERPER_IMAGES_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': serperConfig.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: count }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw AppError.validation(`Serper request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as SerperResponse;
  return (data.images || []).slice(0, count).map((i) => ({
    imageUrl: i.imageUrl,
    link: i.link,
    source: i.source,
    title: i.title,
    width: i.imageWidth,
    height: i.imageHeight,
  }));
}
