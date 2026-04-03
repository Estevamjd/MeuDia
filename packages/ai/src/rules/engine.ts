import type { AIContexto, AIMensagem, AIRule } from './types';
import { regrasTreino } from './treino.rules';
import { regrasHabito } from './habito.rules';
import { regrasDieta } from './dieta.rules';
import { regrasMedicamentos } from './medicamentos.rules';
import { regrasAgenda } from './agenda.rules';
import { regrasFinancas } from './financas.rules';

const todasRegras: AIRule[] = [
  ...regrasTreino,
  ...regrasHabito,
  ...regrasDieta,
  ...regrasMedicamentos,
  ...regrasAgenda,
  ...regrasFinancas,
];

const prioridadeOrdem: Record<string, number> = {
  alerta: 0,
  aviso: 1,
  info: 2,
};

export function avaliarRegras(contexto: AIContexto): AIMensagem[] {
  const mensagens: AIMensagem[] = [];

  for (const regra of todasRegras) {
    try {
      if (regra.condicao(contexto)) {
        mensagens.push({
          id: regra.id,
          modulo: regra.modulo,
          mensagem: regra.mensagem(contexto),
          prioridade: regra.prioridade,
        });
      }
    } catch {
      // Se uma regra falhar, ignorar e continuar
    }
  }

  // Ordenar por prioridade (alerta > aviso > info)
  mensagens.sort((a, b) => (prioridadeOrdem[a.prioridade] ?? 3) - (prioridadeOrdem[b.prioridade] ?? 3));

  return mensagens;
}

export function obterMensagemPrincipal(contexto: AIContexto): AIMensagem | null {
  const mensagens = avaliarRegras(contexto);
  return mensagens[0] ?? null;
}

export function obterMensagensPorModulo(
  contexto: AIContexto,
  modulo: string,
): AIMensagem[] {
  return avaliarRegras(contexto).filter((m) => m.modulo === modulo);
}
