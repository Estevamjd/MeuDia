import 'server-only';
import { formatBRL } from '../financas-ui';
import { aplicarEstilo, primeiroNome } from './contato';
import { chamarClaude } from './ia';
import type { Candidato, Lembrete, TipoLembrete } from './lembretes';
import { sorteio } from './lembretes';
import { ANGULOS, REGRAS_DE_OURO, seguro } from './persona';

/** Texto dos lembretes: Haiku (até 70 tokens) com o mesmo "amigo engraçado"; sem chave ou fora do tom, textos prontos. */

const quandoVence = (vence: string, hoje: string) => {
  const dias = Math.round((Date.parse(`${vence}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
  return dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `dia ${vence.slice(8, 10)}/${vence.slice(5, 7)}`;
};

export const PRONTOS: Record<TipoLembrete, ((n: string, d: Lembrete['dados']) => string)[]> = {
  treino: [
    (n, d) => `${n ? `${n}, hoje` : 'Hoje'} é dia de ${String(d.treino).toLowerCase()}, bora? 💪`,
    (_n, d) => `Ei, o plano diz ${String(d.treino).toLowerCase()} hoje. Vai encarar? 🏋️`,
    (n, d) => `${String(d.treino)} te esperando hoje${n ? `, ${n}` : ''}! Depois me conta como foi 😉`,
  ],
  parabens: [
    (n) => `Vi o treino de hoje registrado${n ? `, ${n}` : ''}. Mandou bem! 🔥`,
    () => 'Treino feito e anotado. Assim que se faz! 💪',
  ],
  checkin: [
    (n) => `${n ? `${n}, teve` : 'Teve'} algum gasto hoje? Me manda que eu anoto 😉`,
    () => 'Passando pra saber: rolou algum gasto hoje? É só mandar, tipo "gastei 20 no lanche".',
    () => 'Fechando o dia: gastou com alguma coisa? Me conta que eu anoto rapidinho 📝',
  ],
  conta: [
    (n, d) => `${n ? `${n}, a` : 'A'} conta de ${d.conta} (${formatBRL(Number(d.valor))}) vence ${quandoVence(String(d.vence), String(d.hoje))}. Já tá no radar? 📅`,
    (_n, d) => `Lembrete amigo: ${d.conta} de ${formatBRL(Number(d.valor))} vence ${quandoVence(String(d.vence), String(d.hoje))} 📅`,
  ],
  refeicao: [
    (n) => `${n ? `${n}, já` : 'Já'} almoçou? Me conta o que comeu que eu anoto 🥗`,
    () => 'Hora do almoço! Quando comer, me manda o que foi pra gente acompanhar a meta 😉',
  ],
};

const SITUACAO: Record<TipoLembrete, (d: Lembrete['dados']) => string> = {
  treino: (d) => `Hoje o plano de treino dela é "${d.treino}" e ela ainda não registrou. Lembre de treinar, animando.`,
  parabens: (d) => `Ela já registrou o treino de hoje ("${d.treino}"). Dê um parabéns curto e leve, sem exagero.`,
  checkin: () => 'Fim do dia e ela não registrou nenhum gasto hoje. Pergunte se teve algum gasto, sem cobrar.',
  conta: (d) => `A conta "${d.conta}" de ${formatBRL(Number(d.valor))} vence ${quandoVence(String(d.vence), String(d.hoje))} e ainda não foi paga. Lembre com leveza; cite nome, valor e quando vence exatamente assim.`,
  refeicao: () => 'Hora do almoço e ela ainda não registrou refeição; ela tem meta de alimentação. Pergunte o que comeu, sem julgar.',
};

export const AVISO_PRIMEIRA = 'Se não quiser lembretes, é só mandar "parar lembretes".';

export function textoPronto(c: Candidato, l: Lembrete, dia: string): string {
  const opcoes = PRONTOS[l.tipo];
  return opcoes[Math.floor(sorteio(c.telefone, dia, l.tipo, 'texto') * opcoes.length) % opcoes.length]!(primeiroNome(c.nome), l.dados);
}

/** Texto final do lembrete. `usarIA=false` (dry-run) não gasta tokens. */
export async function escreverLembrete(c: Candidato, l: Lembrete, dia: string, usarIA = true, fetchFn?: typeof fetch): Promise<string> {
  let texto: string | null = null;
  if (usarIA) {
    const nome = primeiroNome(c.nome) || 'a pessoa';
    const angulo = ANGULOS[Math.floor(sorteio(c.telefone, dia, l.tipo, 'angulo') * ANGULOS.length) % ANGULOS.length];
    const r = await chamarClaude(
      {
        uso: 'lembrete',
        system: [
          `Você é o MeuDia, amigo engraçado de ${nome} no WhatsApp. Português do Brasil, informal e correto.`,
          ...REGRAS_DE_OURO,
          `Escreva UMA mensagem curta (até 22 palavras) puxando conversa, ${angulo}. Use o nome só às vezes.`,
          'Não invente números, datas nem fatos além dos dados. Termine de um jeito que convide a responder.',
          c.estilo.emoji ? 'Pode usar 1 emoji.' : 'Não use emoji.',
          'Responda só a mensagem, sem aspas.',
        ].join('\n'),
        mensagem: [
          `Situação: ${SITUACAO[l.tipo](l.dados)}`,
          `Objetivo dela: ${c.objetivo ?? 'não informado'}. Metas: ${c.metas.join(', ') || 'não informado'}.`,
          c.fatos.length ? `Ela já te contou: ${c.fatos.slice(-5).join('; ')}.` : '',
        ].filter(Boolean).join('\n'),
        maxTokens: 70,
      },
      fetchFn,
    );
    texto = r?.tipo === 'texto' ? seguro(r.texto.split('\n')[0]!.slice(0, 240)) : null;
    // Conta: o texto da IA precisa trazer o valor certo; senão, usa o pronto.
    if (texto && l.tipo === 'conta' && !texto.includes(formatBRL(Number(l.dados.valor)).replace(/\s/g, ' ').replace(/\u00a0/g, ' ').split(' ').pop()!)) texto = null;
  }
  const final = [texto ?? textoPronto(c, l, dia), c.enviosTotal === 0 ? AVISO_PRIMEIRA : ''].filter(Boolean).join('\n');
  return aplicarEstilo(final, c.estilo);
}
