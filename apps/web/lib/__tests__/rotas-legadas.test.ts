import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { DESTINO_ROTA_LEGADA, ROTAS_LEGADAS, isRotaLegada, redirecionamentoModo } from '../app-mode';

const require = createRequire(import.meta.url);

interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
}

describe('rotas legadas (módulos do antigo modo padrão)', () => {
  it('next.config.js redireciona cada uma, com e sem subcaminho, para /financas com 307', async () => {
    const config = require('../../next.config.js') as { redirects: () => Promise<Redirect[]> };
    const redirects = await config.redirects();
    expect(redirects).toHaveLength(ROTAS_LEGADAS.length * 2);
    for (const rota of ROTAS_LEGADAS) {
      for (const source of [rota, `${rota}/:resto*`]) {
        expect(redirects).toContainEqual({ source, destination: DESTINO_ROTA_LEGADA, permanent: false });
      }
    }
  });

  it.each(['/inicio', '/agenda/2026-11-19', '/habitos?x=1', '/dieta', '/veiculo/a/b'])('%s é legada', (rota) => {
    expect(isRotaLegada(rota)).toBe(true);
    // O middleware também manda para /financas (rede de segurança se o redirect do Next não rodar).
    expect(redirecionamentoModo(rota, 'padrao')).toBe('/financas');
    expect(redirecionamentoModo(rota, 'financas')).toBe('/financas');
  });

  it.each(['/financas', '/saude/dieta', '/refeicoes', '/treinos/plano', '/notasx', '/inicial'])('%s não é legada', (rota) => {
    expect(isRotaLegada(rota)).toBe(false);
    expect(redirecionamentoModo(rota, 'padrao')).toBeNull();
  });
});
