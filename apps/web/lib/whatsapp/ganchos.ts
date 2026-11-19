import type { Contato } from './contato';
import type { IntencaoEscrita } from './intencao';
import type { Extras } from './servicos';

/**
 * "Amigo que conhece a pessoa": cruza o que ela registrou com as metas guardadas e decide, só por regras (grátis),
 * se vale um comentário leve. Sem meta que combine, não tem comentário. A IA só escreve o texto depois.
 */
export type Gancho =
  | { tema: 'dieta'; motivo: 'tentacao' | 'saudavel'; item: string }
  | { tema: 'dinheiro'; motivo: 'gasto_extra' | 'estourou'; item: string }
  | { tema: 'treino'; motivo: 'sequencia' | 'voltou'; item: string };

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const TENTACOES =
  /\b(?:hamburgu?er|burger|x[- ]?(?:tudo|burguer|bacon|salada|egg)|mc ?donald'?s?|bk|burger king|pizza|esfiha|refri(?:gerante)?|coca|cerveja|chopp?|breja|batata frita|fritas?|fritura|doces?|chocolate|sorvete|bolo|brigadeiro|acai|donut|rosquinha|coxinha|pastel|salgados?|hot ?dog|cachorro quente|biscoito|bolacha|nutella|milk ?shake|churros|pudim|torta|lasanha|sushi|temaki|ifood|fast ?food)\b/;
const SAUDAVEIS =
  /\b(?:salada|grelhad[oa]|frutas?|legumes|verduras?|ovos?|aveia|peixe|maca|banana|mamao|iogurte natural|batata doce|brocolis|whey|tapioca|cuscuz|frango)\b/;

/** Comida que dá para comprar: a regra usa para "comprei um hambúrguer" (sem valor) virar refeição. */
export const COMIDA = new RegExp(`${TENTACOES.source}|${SAUDAVEIS.source}|\\b(?:lanche|marmita|sanduiche|pao|cafe|suco)\\b`);

const OBJ_DIETA = /emagrec|perder (?:peso|barriga|gordura)|\bsecar\b|dieta|definir|definicao|comer melhor|alimenta|saud|\bkg\b|quilos?|barriga/;
const OBJ_DINHEIRO = /guardar|juntar|econom|poupar|viag|divida|quitar|reserva|casa propria|apartamento|carro|investir|vermelho|sobrar|organizar (?:as )?financ|grana|dinheiro/;
const OBJ_TREINO = /massa|treino|treinar|academia|correr|corrida|maratona|condicionamento|forca|hipertrofia|musculo|shape|crossfit|malhar/;
const CATEGORIAS_EXTRAS = new Set(['Lazer', 'Comida', 'Restaurante', 'Roupa', 'Delivery', 'Compras', 'Streaming', 'Presente', 'Cabelo', 'Unha']);

const objetivo = (c: Pick<Contato, 'objetivo'>) => semAcento(c.objetivo ?? '');
export const temMetaDieta = (c: Pick<Contato, 'objetivo' | 'metas'>) => c.metas.includes('dieta') || OBJ_DIETA.test(objetivo(c));
export const temMetaDinheiro = (c: Pick<Contato, 'objetivo'>) => OBJ_DINHEIRO.test(objetivo(c));
export const temMetaTreino = (c: Pick<Contato, 'objetivo' | 'metas'>) => c.metas.includes('treino') || OBJ_TREINO.test(objetivo(c));

export function ganchoDaMeta(i: IntencaoEscrita, contato: Pick<Contato, 'objetivo' | 'metas'>, extras: Extras | undefined): Gancho | null {
  const desc = 'descricao' in i ? i.descricao : '';
  const texto = semAcento(`${desc} ${'categoria' in i ? i.categoria : ''}`);

  if ((i.tipo === 'refeicao' || i.tipo === 'gasto') && temMetaDieta(contato)) {
    if (TENTACOES.test(texto)) return { tema: 'dieta', motivo: 'tentacao', item: desc };
    if (i.tipo === 'refeicao' && SAUDAVEIS.test(texto) && !TENTACOES.test(texto)) return { tema: 'dieta', motivo: 'saudavel', item: desc };
  }
  if (i.tipo === 'gasto') {
    const estourou = extras?.planejado != null && extras.gasto_mes != null && Number(extras.gasto_mes) > Number(extras.planejado);
    const querDinheiro = temMetaDinheiro(contato);
    if (estourou && (querDinheiro || contato.metas.includes('dinheiro'))) return { tema: 'dinheiro', motivo: 'estourou', item: i.categoria };
    if (querDinheiro && CATEGORIAS_EXTRAS.has(i.categoria)) return { tema: 'dinheiro', motivo: 'gasto_extra', item: desc || i.categoria };
  }
  if (i.tipo === 'treino' && temMetaTreino(contato)) {
    if (extras?.dias_sem_treino != null && extras.dias_sem_treino >= 7) return { tema: 'treino', motivo: 'voltou', item: desc };
    if ((extras?.treinos_semana ?? 0) >= 2) return { tema: 'treino', motivo: 'sequencia', item: desc };
  }
  return null;
}
