import { rotuloRefeicao } from '@meudia/shared';
import { formatBRL } from '../financas-ui';
import { aplicarEstilo, ESTILO_PADRAO, primeiroNome, type Estilo } from './contato';
import type { IntencaoEscrita } from './intencao';
import type { Extras } from './servicos';

export const AJUDA = [
  'Oi! Eu anoto pra você no MeuDia. Exemplos:',
  '• gastei 45,90 no mercado',
  '• recebi 500 do freela',
  '• treinei peito 40min',
  '• almocei arroz, feijão e frango',
  'Pode escrever "ontem" para o dia anterior.',
].join('\n');

export const NAO_ENTENDI = 'Não entendi 🤔 Tente algo como "gastei 30 no uber" ou "treinei pernas 50min". Mande "ajuda" para ver exemplos.';
export const SEM_CONTA = 'Este número ainda não está ligado a uma conta. Mande "oi" que eu te ajudo a ligar, ou no app: Configurações → Seu WhatsApp.';
export const FALHOU = 'Não consegui anotar agora. Tente de novo em instantes ou lance pelo app.';

const quando = (data?: string) => (data ? ` (${data.slice(8, 10)}/${data.slice(5, 7)})` : '');

/** "Faz antes de pedir": o que dá para antecipar a partir do que o banco devolveu. */
export function dicasProativas(i: IntencaoEscrita, extras: Extras | undefined): string[] {
  if (!extras) return [];
  const dicas: string[] = [];
  if (i.tipo === 'gasto' && extras.planejado != null && extras.gasto_mes != null) {
    const resta = Number(extras.planejado) - Number(extras.gasto_mes);
    dicas.push(
      resta >= 0
        ? `Ainda tem ${formatBRL(resta)} do orçamento de ${extras.categoria} este mês.`
        : `Passou ${formatBRL(-resta)} do planejado para ${extras.categoria} este mês. Bora segurar um pouco? 💡`,
    );
  }
  if ((i.tipo === 'gasto' || i.tipo === 'entrada') && extras.conta_descricao) {
    dicas.push(`📅 Lembrete: ${extras.conta_descricao} (${formatBRL(Number(extras.conta_valor))}) vence dia ${extras.conta_dia}.`);
  }
  if (i.tipo === 'treino' && extras.treinos_semana) {
    const n = extras.treinos_semana;
    dicas.push(n === 1 ? 'Primeiro treino da semana, começou bem! 🔥' : `Já são ${n} dias de treino nesta semana, tá voando! 🔥`);
  }
  if (i.tipo === 'refeicao' && extras.refeicoes_dia && extras.refeicoes_dia >= 2) {
    dicas.push(`${extras.refeicoes_dia} refeições anotadas no dia. 👏`);
  }
  return dicas;
}

export function confirmacao(i: IntencaoEscrita, nome?: string | null, extras?: Extras, estilo: Estilo = ESTILO_PADRAO): string {
  const oi = nome ? `, ${primeiroNome(nome)}` : '';
  let base: string;
  switch (i.tipo) {
    case 'gasto':
      base = `✅ Anotado${oi}: gasto de ${formatBRL(i.valor)} · ${i.categoria}${i.descricao ? ` (${i.descricao})` : ''}${quando(i.data)}.`;
      break;
    case 'entrada':
      base = `✅ Anotado${oi}: entrada de ${formatBRL(i.valor)} · ${i.categoria}${quando(i.data)}.`;
      break;
    case 'treino':
      base = `💪 Treino anotado: ${i.descricao}${i.duracao_min ? ` · ${i.duracao_min} min` : ''}${quando(i.data)}. Boa${oi}!`;
      break;
    case 'refeicao':
      base = `🥗 ${rotuloRefeicao(i.refeicao)} anotado: ${i.descricao}${quando(i.data)}.`;
      break;
  }
  // Curto: só a dica mais útil. Detalhado: todas.
  const dicas = dicasProativas(i, extras).slice(0, estilo.tamanho === 'curto' ? 1 : undefined);
  return aplicarEstilo([base, ...dicas].join('\n'), estilo);
}

export const LIMITE_DIA = (app: string) =>
  `Por hoje chegamos no limite de mensagens 😅 Amanhã eu volto a anotar. Pelo app dá pra lançar à vontade: ${app}`;

export function erroRpc(erro: string | undefined): string {
  switch (erro) {
    case 'numero_sem_conta':
      return SEM_CONTA;
    case 'valor_invalido':
      return 'O valor não parece certo. Ex.: "gastei 45,90 no mercado".';
    case 'data_invalida':
      return 'Só consigo anotar até 60 dias para trás.';
    default:
      return FALHOU;
  }
}
