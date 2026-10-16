import { NextResponse } from 'next/server';
import { getAppMode } from '../../lib/app-mode';
import { buildManifest } from '../../lib/manifest';

// APP_MODE é lido em runtime (não congelar no build).
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(buildManifest(getAppMode()), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
