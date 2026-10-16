import { NextResponse } from 'next/server';
import { getAppMode } from '../../lib/app-mode';
import { buildManifest } from '../../lib/manifest';

// Substitui o antigo public/manifest.json estático (que mantinha atalhos como /treinos
// mesmo com APP_MODE=financas): mesma URL, conteúdo filtrado pelo modo em runtime.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(buildManifest(getAppMode()), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
