import { rotuloRefeicao } from '@meudia/shared';
import { formatBRL } from '../financas-ui';
import type { IntencaoEscrita } from './intencao';

export const AJUDA = [
  'Oi! Eu anoto pra você no MeuDia. Exemplos:',
  '• gastei 45,90 no mercado',
  '• recebi 500 do freela',
  '• treinei peito 40min',
  '• almocei arroz, feijão e frango',
  'Pode escrever "ontem" para o dia anterior.',
].join('\n');

export const NAO_ENTENDI = 'Não entendi 🤔 Tente algo como "gastei 30 no uber" ou "treinei pernas 50min". Mande "ajuda" para ver exemplos.';
export const SEM_CONTA = 'Este número ainda não está ligado a uma conta. No app: Configurações → Seu WhatsApp.';
export const FALHOU = 'Não consegui anotar agora. Tente de novo em instantes ou lance pelo app.';

const quando = (data?: string) => (data ? ` (${data.slice(8, 10)}/${data.slice(5, 7)})` : '');

export function confirmacao(i: IntencaoEscrita, nome?: string | null): string {
  const oi = nome ? `, ${nome.split(' ')[0]}` : '';
  switch (i.tipo) {
    case 'gasto':
      return `✅ Anotado${oi}: gasto de ${formatBRL(i.valor)} · ${i.categoria}${i.descricao ? ` (${i.descricao})` : ''}${quando(i.data)}.`;
    case 'entrada':
      return `✅ Anotado${oi}: entrada de ${formatBRL(i.valor)} · ${i.categoria}${quando(i.data)}.`;
    case 'treino':
      return `💪 Treino anotado: ${i.descricao}${i.duracao_min ? ` · ${i.duracao_min} min` : ''}${quando(i.data)}. Boa${oi}!`;
    case 'refeicao':
      return `🥗 ${rotuloRefeicao(i.refeicao)} anotado: ${i.descricao}${quando(i.data)}.`;
  }
}

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
