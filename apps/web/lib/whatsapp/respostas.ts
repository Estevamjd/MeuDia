import { hojeSP, rotuloRefeicao } from '@meudia/shared';
import { formatBRL } from '../financas-ui';
import { aplicarEstilo, ESTILO_PADRAO, primeiroNome, type Estilo } from './contato';
import { interpretarPorRegras } from './regras';
import type { IntencaoEscrita } from './intencao';
import type { Extras } from './servicos';

export const AJUDA = [
  'Oi! Eu anoto pra você no MeuDia. Exemplos:',
  '• gastei 45,90 no mercado',
  '• recebi 500 do freela',
  '• treinei peito 40min',
  '• almocei arroz, feijão e frango',
  '• lembra que não gosto de academia de manhã',
  '• desfazer (último registro do WhatsApp, em até 30 minutos)',
  '• lembretes às 19h / parar lembretes',
  'Pode escrever "ontem" para o dia anterior. "esquece tudo" apaga o que eu lembro.',
].join('\n');

export const LEMBREI = (nome?: string | null) => `Guardado${nome ? `, ${primeiroNome(nome)}` : ''}! Vou levar isso em conta 😉`;
export const LEMBRETES_PARADOS = 'Combinado, parei os lembretes. Se quiser de volta, é só mandar "voltar lembretes" 😉';
export const LEMBRETES_VOLTARAM = 'Lembretes de volta! Vou te dar um toque de vez em quando: no máximo 2 por dia e nunca entre 22h e 8h 😉';
export const LEMBRETE_HORA = (h: number) => `Fechado: lembrete de treino lá pelas ${h}h ⏰`;
export const LEMBRETE_HORA_INVALIDA = 'Só mando lembretes entre 8h e 21h. Me fala um horário nesse intervalo?';
export const ESQUECI = 'Pronto, esqueci tudo o que você tinha me pedido pra lembrar.';

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

export function confirmacao(i: IntencaoEscrita, nome?: string | null, extras?: Extras, estilo: Estilo = ESTILO_PADRAO, comentario?: string | null): string {
  const oi = nome ? `, ${primeiroNome(nome)}` : '';
  let base: string;
  switch (i.tipo) {
    case 'gasto':
      base = `✅ Anotado${oi}: gasto${(i.valor ?? extras?.valor_registrado) != null ? ` de ${formatBRL(Number(i.valor ?? extras?.valor_registrado))}` : ''} · ${i.categoria}${i.descricao ? ` (${i.descricao})` : ''}${quando(i.data)}.`;
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
  if (i.tipo === 'gasto' && extras?.conta_paga) base = `${base.replace(/\.$/, '')} e marquei a conta ${extras.conta_paga} como paga.`;
  if (i.tipo === 'gasto' && extras?.conta_divergente) {
    const conta = extras.conta_divergente;
    const frase = `paguei ${conta.descricao.toLocaleLowerCase('pt-BR')}`;
    const lida = interpretarPorRegras(frase, { hojeISO: hojeSP(), horaSP: 12 });
    const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
    const segura = lida.tipo === 'gasto' && lida.pagar === true && lida.valor === null
      && normalizar(lida.descricao ?? '') === normalizar(conta.descricao);
    base += ` Lancei como gasto separado: a conta ${conta.descricao} é de ${formatBRL(Number(conta.valor))} e continua pendente. `;
    base += segura ? `Para marcar como paga, mande "${frase}".` : 'Marque como paga no app (Contas a vencer → Paguei).';
    base += ' Se esse gasto já era a conta, mande "desfazer" (válido por 30 min) antes de marcar como paga, para evitar contar duas vezes.';
  }
  // Curto: só a dica mais útil (o comentário de amigo, quando há, vem no lugar dela). Detalhado: todas + comentário.
  const todas = dicasProativas(i, extras);
  const dicas = estilo.tamanho === 'detalhado' ? todas : comentario ? [] : todas.slice(0, 1);
  return aplicarEstilo([base, ...dicas, comentario].filter(Boolean).join('\n'), estilo);
}

export const LIMITE_DIA = (app: string) =>
  `Por hoje chegamos no limite de mensagens 😅 Amanhã eu volto a anotar. Pelo app dá pra lançar à vontade: ${app}`;

export function erroRpc(erro: string | undefined): string {
  switch (erro) {
    case 'numero_sem_conta':
      return SEM_CONTA;
    case 'conta_nao_identificada':
      return 'Não identifiquei uma única conta pendente com esse nome. Me diga o nome completo e o valor, por exemplo: "paguei 120 de luz".';
    case 'valor_invalido':
      return 'O valor não parece certo. Ex.: "gastei 45,90 no mercado".';
    case 'data_invalida':
      return 'Só consigo anotar até 60 dias para trás.';
    default:
      return FALHOU;
  }
}

export const NADA_PARA_DESFAZER = 'Não encontrei registro feito pelo WhatsApp nos últimos 30 minutos para desfazer.';
export function confirmacaoDesfazer(r: { descricao?: string; valor?: number | null }): string {
  return `↩️ Desfiz: ${r.descricao ?? 'último registro'}${r.valor != null ? ` ${formatBRL(Number(r.valor))}` : ''}.`;
}
