// ══════════════════════════════════════════════════════════════════════════════
// Agente MeuDia — Ponto de entrada
// ══════════════════════════════════════════════════════════════════════════════

export { classificarIntencao, extrairParametros, extrairParametrosData } from './intencao';
export { processarMensagem } from './chat';
export {
  obterSaudacao,
  statusTreino,
  statusHabitos,
  statusFinancas,
  statusAgenda,
} from './contexto';
export {
  isAcaoNavegacao,
  obterRotaNavegacao,
  isAcaoComando,
  obterComando,
  acoesRapidasPadrao,
} from './acoes';
