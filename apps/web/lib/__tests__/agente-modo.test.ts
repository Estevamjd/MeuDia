import { describe, expect, it } from 'vitest';
import type { AcaoRapida, MensagemChat } from '@meudia/shared';
import {
  abaInicialAgente,
  abasAgente,
  filtrarAcoes,
  filtrarMensagens,
  isAcaoPermitida,
  sugestoesAgente,
} from '../agente-modo';

const ACOES: AcaoRapida[] = [
  { label: 'Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } },
  { label: 'Contas', acao: 'NAVEGAR', payload: { rota: '/financas/contas?nova=1' } },
  { label: 'Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
  { label: 'Agenda', acao: 'CRIAR_COMPROMISSO', payload: { titulo: 'x', data_inicio: 'y' } },
  { label: 'Pergunta', acao: 'COMANDO', payload: { comando: 'saldo' } },
];

describe('agente-modo', () => {
  it('abas e aba inicial por modo', () => {
    expect(abasAgente('financas')).toEqual(['treino', 'alertas']);
    expect(abaInicialAgente('financas')).toBe('treino');
    expect(abasAgente('padrao')).toEqual(['resumo', 'treino', 'alertas']);
    expect(abaInicialAgente('padrao')).toBe('resumo');
  });

  it('financas: remove navegação para módulos ocultos e criar compromisso', () => {
    expect(filtrarAcoes(ACOES, 'financas').map((a) => a.label)).toEqual(['Finanças', 'Contas', 'Pergunta']);
    expect(isAcaoPermitida({ acao: 'NAVEGAR' }, 'financas')).toBe(false);
    expect(filtrarAcoes(ACOES, 'padrao')).toEqual(ACOES);
  });

  it('sugestões: financas só navega para rotas visíveis; padrão usa as do agente', () => {
    const fin = sugestoesAgente('financas', () => ACOES);
    expect(filtrarAcoes(fin, 'financas')).toEqual(fin);
    expect(sugestoesAgente('padrao', () => ACOES)).toBe(ACOES);
  });

  it('mensagens do chat perdem ações ocultas só no modo financas', () => {
    const msg = { id: 'm', role: 'agent', conteudo: 'oi', acoes: ACOES } as MensagemChat;
    expect(filtrarMensagens([msg], 'financas')[0]!.acoes).toHaveLength(3);
    expect(filtrarMensagens([msg], 'padrao')[0]!.acoes).toHaveLength(5);
  });
});
