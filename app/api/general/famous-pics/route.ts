import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/errors';

const FAMOUS_PICS_DIR = path.join(process.cwd(), 'public', 'Famous-pics');
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function handler(): Promise<NextResponse> {
  const entries = await fs.readdir(FAMOUS_PICS_DIR);
  const pics = entries
    .filter((name) => ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort();

  return NextResponse.json(
    { pics },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' } }
  );
}

export const GET = withErrorHandler(handler);
