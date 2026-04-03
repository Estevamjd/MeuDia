// ══════════════════════════════════════════════════════════════════════════════
// Regras existentes (motor de regras)
// ══════════════════════════════════════════════════════════════════════════════
export {
  avaliarRegras,
  obterMensagemPrincipal,
  obterMensagensPorModulo,
  regrasTreino,
  regrasHabito,
  regrasDieta,
  regrasMedicamentos,
  regrasAgenda,
  regrasFinancas,
  regrasNotificacao,
  verificarNotificacoes,
} from './rules';
export type { AIContexto, AIMensagem, AIRule } from './rules';

// ══════════════════════════════════════════════════════════════════════════════
// Agente (chat, intenções, ações)
// ══════════════════════════════════════════════════════════════════════════════
export {
  classificarIntencao,
  processarMensagem,
  obterSaudacao,
  statusTreino,
  statusHabitos,
  statusFinancas,
  statusAgenda,
  isAcaoNavegacao,
  obterRotaNavegacao,
  isAcaoComando,
  obterComando,
  acoesRapidasPadrao,
} from './agent';

// ══════════════════════════════════════════════════════════════════════════════
// Analyzers (análise de dados)
// ══════════════════════════════════════════════════════════════════════════════
export {
  analisarCarga,
  calcularDescansoSugerido,
  obterDicaDescanso,
  analisarConsistencia,
  analisarFinancasMes,
} from './analyzers';

// ══════════════════════════════════════════════════════════════════════════════
// Generators (geração de conteúdo)
// ══════════════════════════════════════════════════════════════════════════════
export { gerarResumoDiario } from './generators';
