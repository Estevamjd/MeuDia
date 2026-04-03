import type { AcaoRapida, ContextoUsuario } from '@meudia/shared';

/**
 * Tipos de ação que o agente pode executar.
 */
export type TipoAcaoAgente =
  | 'NAVEGAR'
  | 'ABRIR_TREINO'
  | 'ABRIR_HABITOS'
  | 'ABRIR_AGENDA'
  | 'ABRIR_FINANCAS'
  | 'MARCAR_DESCANSO'
  | 'COMANDO'
  | 'INFO';

/**
 * Verifica se uma ação é de navegação.
 */
export function isAcaoNavegacao(acao: AcaoRapida): boolean {
  return acao.acao === 'NAVEGAR' && !!acao.payload?.rota;
}

/**
 * Obtém a rota de navegação de uma ação, se aplicável.
 */
export function obterRotaNavegacao(acao: AcaoRapida): string | null {
  if (isAcaoNavegacao(acao) && acao.payload) {
    return acao.payload.rota as string;
  }
  return null;
}

/**
 * Verifica se a ação é um comando para o chat.
 */
export function isAcaoComando(acao: AcaoRapida): boolean {
  return acao.acao === 'COMANDO' && !!acao.payload?.comando;
}

/**
 * Obtém o comando de uma ação, se aplicável.
 */
export function obterComando(acao: AcaoRapida): string | null {
  if (isAcaoComando(acao) && acao.payload) {
    return acao.payload.comando as string;
  }
  return null;
}

/**
 * Gera ações rápidas padrão para o agente (sugestões iniciais do chat).
 * Quando recebe contexto, gera sugestões inteligentes baseadas no estado atual.
 */
export function acoesRapidasPadrao(contexto?: ContextoUsuario): AcaoRapida[] {
  const acoes: AcaoRapida[] = [
    {
      label: 'Resumo do dia',
      acao: 'COMANDO',
      payload: { comando: 'como foi meu dia hoje?' },
    },
  ];

  if (contexto?.treinoHoje && !contexto.treinoHoje.concluido) {
    acoes.push({
      label: `Treino: ${contexto.treinoHoje.nome}`,
      acao: 'COMANDO',
      payload: { comando: 'qual é meu treino de hoje?' },
    });
  }

  if (contexto && contexto.habitosPendentes.length > 0) {
    acoes.push({
      label: `${contexto.habitosPendentes.length} hábitos pendentes`,
      acao: 'COMANDO',
      payload: { comando: 'como estão meus hábitos?' },
    });
  }

  if (contexto && contexto.compromissosHoje > 0) {
    acoes.push({
      label: `${contexto.compromissosHoje} compromisso(s)`,
      acao: 'COMANDO',
      payload: { comando: 'o que tenho na agenda hoje?' },
    });
  }

  if (acoes.length < 3) {
    acoes.push({
      label: 'Criar compromisso',
      acao: 'COMANDO',
      payload: { comando: 'criar compromisso' },
    });
  }

  if (acoes.length < 4) {
    acoes.push({
      label: 'Ver finanças',
      acao: 'COMANDO',
      payload: { comando: 'como estão minhas finanças?' },
    });
  }

  return acoes.slice(0, 4);
}
