import { hojeSP, competenciaDe, etapaLembrete, ocorrenciaDaConta, LEMBRETE_TEXTOS, type PushSubscriptionRow } from '@meudia/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { contasPagarRepository, pagamentosContaRepository, pushSubscriptionsRepository, lembretesEnviadosRepository } from '../repositories';

export interface PushPayload { title: string; body: string; url: string; tag: string }
export interface PushSender { send(sub: PushSubscriptionRow, payload: PushPayload): Promise<{ statusCode: number }> }
export async function enviarLembretesDoDia({ client, sender, hojeISO = hojeSP() }: { client: SupabaseClient; sender: PushSender; hojeISO?: string }) {
  const hoje = new Date(`${hojeISO}T00:00:00Z`);
  const proxima = new Date(hoje); proxima.setUTCDate(1); proxima.setUTCMonth(proxima.getUTCMonth() + 1);
  // D-2 dos dias 1 e 2 ocorre no mês anterior à competência do vencimento.
  const competencias = [competenciaDe(hojeISO), competenciaDe(proxima.toISOString())];
  const contas = await contasPagarRepository.contasAtivasComInscricaoParaCron(client);
  const usuarios = [...new Set(contas.map(c => c.user_id))];
  const pagamentos = await pagamentosContaRepository.pagamentosDasCompetenciasParaCron(client, competencias, usuarios);
  const pagos = new Set(pagamentos.map(p => `${p.conta_id}:${p.competencia}`));
  const inscricoes = new Map<string, PushSubscriptionRow[]>();
  const resultado = { contas: contas.length, enviados: 0, ignorados: 0, inscricoesRemovidas: 0 };
  for (const conta of contas) {
    if (!conta.ativo) { resultado.ignorados++; continue; }
    for (const competencia of competencias) {
      const ocorrencia = ocorrenciaDaConta(conta, competencia);
      const etapa = ocorrencia && etapaLembrete(ocorrencia.vencimento, hojeISO);
      if (!ocorrencia || !etapa || pagos.has(`${conta.id}:${competencia}`)) { resultado.ignorados++; continue; }
      if (!inscricoes.has(conta.user_id)) inscricoes.set(conta.user_id, await pushSubscriptionsRepository.inscricoesDoUsuarioParaCron(client, conta.user_id));
      const subs = inscricoes.get(conta.user_id)!;
      if (!subs.length) { resultado.ignorados++; continue; }
      const reservou = await lembretesEnviadosRepository.reservarLembreteParaCron(client, { user_id: conta.user_id, conta_id: conta.id, competencia, etapa, canal: 'push' });
      if (!reservou) { resultado.ignorados++; continue; }
      const texto = LEMBRETE_TEXTOS[etapa];
      const payload: PushPayload = {
        title: texto.title,
        body: texto.body.replace('<descricao>', () => conta.descricao)
          .replace('<valor>', Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
          .replace('<dd/MM>', `${ocorrencia.vencimento.slice(8, 10)}/${ocorrencia.vencimento.slice(5, 7)}`),
        url: `/financas/contas/${conta.id}?competencia=${competencia}`, tag: `conta-${conta.id}-${competencia}`,
      };
      for (const sub of [...subs]) {
        let status: number | undefined;
        try { status = (await sender.send(sub, payload)).statusCode; }
        catch (error) { status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : undefined; }
        if (status === 404 || status === 410) {
          inscricoes.set(conta.user_id, inscricoes.get(conta.user_id)!.filter(s => s.id !== sub.id));
          try {
            await pushSubscriptionsRepository.removerInscricaoParaCron(client, sub.id);
            resultado.inscricoesRemovidas++;
          } catch { console.error('Falha ao remover inscrição push expirada'); }
        } else if (status !== undefined && status >= 200 && status < 300) resultado.enviados++;
        else console.error('Falha no envio de lembrete push');
      }
    }
  }
  return resultado;
}
