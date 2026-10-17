import fs from 'node:fs';
import path from 'node:path';

/**
 * Pasta das screenshots de evidência (não versionadas). EVIDENCIAS_DIR manda; sem ela, usa
 * /workspace/evidencias/<feature> quando /workspace existe (máquina do agente) e, no CI,
 * e2e/artifacts/evidencias/<feature>, que o workflow sobe como artefato.
 */
export function pastaEvidencias(feature: string): string {
  const pasta =
    process.env.EVIDENCIAS_DIR ||
    (fs.existsSync('/workspace/evidencias')
      ? path.join('/workspace/evidencias', feature)
      : path.join(__dirname, 'artifacts', 'evidencias', feature));
  fs.mkdirSync(pasta, { recursive: true });
  return pasta;
}
