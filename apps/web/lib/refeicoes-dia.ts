import type { ItemRefeicao, Refeicao, RefeicaoModelo, TipoRefeicao, TotalRefeicao } from '@meudia/shared';
import { MODELO_DIETA_V1, totalRefeicao } from '@meudia/shared';

/**
 * Linha do tempo do dia (Hoje e Dieta) sem a 009: `refeicoes` ainda não tem nome, horário nem "feita".
 * - Nome e hora vêm do modelo do dia (`MODELO_DIETA_V1`), pelo `tipo`.
 * - Feita = existe registro em `refeicoes` naquele dia (como a tela antiga de Dieta sempre tratou).
 * - Pendente = horário do modelo sem registro; mostra os itens do modelo, sem valor.
 */
export interface EntradaRefeicao {
  chave: string;
  tipo: TipoRefeicao;
  nome: string;
  horario: string;
  feita: boolean;
  refeicao: Refeicao | null;
  itens: ItemRefeicao[];
  total: TotalRefeicao | null;
}

const modeloPorTipo = (modelo: readonly RefeicaoModelo[]) => new Map(modelo.map((m) => [m.tipo, m]));

/** Itens do modelo sem valor nutricional (nunca 0). */
export function itensDoModelo(m: RefeicaoModelo): ItemRefeicao[] {
  return m.itens.map((nome) => ({ nome, calorias: null, proteina: null, fonte: 'manual' }));
}

export function linhaDoTempo(refeicoes: readonly Refeicao[], modelo: readonly RefeicaoModelo[] = MODELO_DIETA_V1): EntradaRefeicao[] {
  const porTipo = modeloPorTipo(modelo);
  const feitas: EntradaRefeicao[] = refeicoes.map((r) => {
    const m = porTipo.get(r.tipo);
    return {
      chave: r.id,
      tipo: r.tipo,
      nome: m?.nome ?? r.tipo,
      horario: m?.horario ?? '—',
      feita: true,
      refeicao: r,
      itens: Array.isArray(r.items) ? r.items : [],
      total: totalRefeicao(r),
    };
  });
  const tiposFeitos = new Set(refeicoes.map((r) => r.tipo));
  const pendentes: EntradaRefeicao[] = modelo
    .filter((m) => !tiposFeitos.has(m.tipo))
    .map((m) => ({
      chave: `modelo-${m.tipo}`,
      tipo: m.tipo,
      nome: m.nome,
      horario: m.horario,
      feita: false,
      refeicao: null,
      itens: itensDoModelo(m),
      total: null,
    }));
  const ordemTipo = new Map(modelo.map((m, i) => [m.tipo, i]));
  return [...feitas, ...pendentes].sort(
    (a, b) => (ordemTipo.get(a.tipo) ?? 99) - (ordemTipo.get(b.tipo) ?? 99) || Number(b.feita) - Number(a.feita),
  );
}

/** Até 4 entradas para a Início do módulo: a partir de duas antes da primeira pendente; tudo feito = as 4 últimas. */
export function recorteHoje(entradas: readonly EntradaRefeicao[], max = 4): EntradaRefeicao[] {
  const primeiraPendente = entradas.findIndex((e) => !e.feita);
  const inicio =
    primeiraPendente === -1 ? Math.max(0, entradas.length - max) : Math.min(Math.max(0, primeiraPendente - 2), Math.max(0, entradas.length - max));
  return entradas.slice(inicio, inicio + max);
}

/** "Pão francês · ovos · queijo" (o primeiro com maiúscula, como no caderno). */
export function resumoItens(itens: readonly ItemRefeicao[]): string {
  const nomes = itens.map((i) => i.nome.trim()).filter(Boolean);
  if (nomes.length === 0) return 'Sem itens';
  const [primeiro, ...resto] = nomes;
  return [primeiro!.charAt(0).toUpperCase() + primeiro!.slice(1), ...resto].join(' · ');
}

/** Copia uma refeição para registrar de novo (duplicar): mesmos itens e totais, sem id. */
export function copiaRefeicao(r: Refeicao) {
  return {
    tipo: r.tipo,
    data: r.data,
    items: r.items,
    total_calorias: r.total_calorias,
    total_proteina: r.total_proteina,
    total_carbo: r.total_carbo,
    total_gordura: r.total_gordura,
  };
}

/** Colunas total_* (INTEGER/DECIMAL DEFAULT 0) a partir dos itens: só o que tem valor; a tela usa os itens. */
export function totaisDosItens(itens: readonly ItemRefeicao[]) {
  const soma = (campo: 'calorias' | 'proteina' | 'carbo' | 'gordura') =>
    itens.reduce((s, i) => s + (typeof i[campo] === 'number' ? (i[campo] as number) : 0), 0);
  return {
    total_calorias: Math.round(soma('calorias')),
    total_proteina: Math.round(soma('proteina') * 100) / 100,
    total_carbo: Math.round(soma('carbo') * 100) / 100,
    total_gordura: Math.round(soma('gordura') * 100) / 100,
  };
}
