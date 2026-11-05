import { describe, expect, it } from 'vitest';
import type { AcaoRapida, ContextoUsuario, MensagemChat } from '@meudia/shared';
import { processarMensagem } from '@meudia/ai';
import {
  abaInicialAgente,
  abasAgente,
  adaptarRespostaAoModo,
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

  it('financas: remove navegação para módulos ocultos e criar compromisso; Treinos fica (aparece para todos)', () => {
    expect(filtrarAcoes(ACOES, 'financas').map((a) => a.label)).toEqual(['Finanças', 'Contas', 'Treinos', 'Pergunta']);
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
    expect(filtrarMensagens([msg], 'financas')[0]!.acoes).toHaveLength(4);
    expect(filtrarMensagens([msg], 'padrao')[0]!.acoes).toHaveLength(5);
  });

  it('mensagem antiga que oferecia "Criar Agora" é reescrita no modo financas (sem botão órfão)', () => {
    const msg = { id: 'm', role: 'agent', conteudo: 'Clique em "Criar Agora" para confirmar.', acoes: [ACOES[3]!] } as MensagemChat;
    const [fin] = filtrarMensagens([msg], 'financas');
    expect(fin!.conteudo).toMatch(/agenda .*não está disponível no modo Finanças/);
    expect(fin!.conteudo).not.toContain('Criar Agora');
    expect(fin!.acoes).toEqual([]);
    expect(filtrarMensagens([msg], 'padrao')[0]!.conteudo).toBe(msg.conteudo);
  });
});

describe('adaptarRespostaAoModo (motor de regras real)', () => {
  const contexto: ContextoUsuario = {
    userId: 'u1',
    nome: 'Ana',
    objetivo: null,
    horaAtual: 10,
    diaSemana: 6,
    treinoHoje: null,
    sessoesSemana: 0,
    metaTreinosSemana: 0,
    habitosTotal: 0,
    habitosConcluidos: 0,
    habitosPendentes: [],
    percentualHabitos: 0,
    compromissosHoje: 0,
    proximoCompromisso: null,
    saldoMes: 100,
    despesasMes: 50,
    receitasMes: 150,
    streakAtual: 0,
    scoreHoje: 0,
  };
  const responder = (texto: string, mode: 'financas' | 'padrao') => adaptarRespostaAoModo(texto, processarMensagem(texto, contexto), mode);

  it('agenda com título e data: o pacote ai oferece o botão sem citar o nome no texto', () => {
    const r = processarMensagem('marcar reunião dia 15 às 10h', contexto);
    expect(r.acoes?.map((a) => a.acao)).toContain('CRIAR_COMPROMISSO');
    expect(r.mensagem).not.toContain('Criar Agora');
  });

  it.each(['marcar reunião dia 15 às 10h', 'Adicione uma tarefa: comprar pão amanhã às 9h', 'o que tenho amanhã', 'criar compromisso'])(
    'financas: "%s" diz que a agenda não está disponível, sem ação de agenda',
    (texto) => {
      const r = responder(texto, 'financas');
      expect(r.mensagem).toMatch(/agenda \(compromissos e tarefas\) não está disponível no modo Finanças/);
      expect(r.mensagem).not.toContain('Criar Agora');
      expect(r.acoes?.some((a) => a.acao === 'CRIAR_COMPROMISSO' || a.payload?.rota === '/agenda')).toBe(false);
      expect(filtrarAcoes(r.acoes, 'financas')).toEqual(r.acoes);
    },
  );

  it.each(['cria um treino de peito', 'qual meu treino de hoje'])('financas: "%s" responde como no modo padrão (Treinos aparece para todos)', (texto) => {
    const r = responder(texto, 'financas');
    expect(r.mensagem).not.toMatch(/não está disponível|não estão disponíveis/);
    expect(r.mensagem).toBe(processarMensagem(texto, contexto).mensagem);
  });

  it.each([
    ['criar hábito de ler', /Hábitos não estão disponíveis/],
    ['abrir minhas notas', /Notas não estão disponíveis/],
  ])('financas: "%s" avisa o módulo indisponível', (texto, esperado) => {
    expect(responder(texto, 'financas').mensagem).toMatch(esperado);
  });

  it('padrão mantém a resposta e o botão de criar', () => {
    const texto = 'marcar reunião dia 15 às 10h';
    expect(responder(texto, 'padrao')).toEqual(processarMensagem(texto, contexto));
    expect(responder(texto, 'padrao').acoes?.map((a) => a.label)).toContain('Criar Agora');
  });

  it('financas: resposta de finanças segue igual (só filtra ações ocultas)', () => {
    const texto = 'como estão minhas finanças?';
    const r = responder(texto, 'financas');
    expect(r.mensagem).toBe(processarMensagem(texto, contexto).mensagem);
  });
});
