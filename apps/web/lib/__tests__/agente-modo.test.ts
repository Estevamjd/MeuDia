import { describe, expect, it } from 'vitest';
import type { AcaoRapida, MensagemChat, NotificacaoAgente } from '@meudia/shared';
import { ABAS_AGENTE, SUGESTOES_AGENTE, filtrarAcoes, filtrarMensagens, filtrarNotificacoes, isAcaoPermitida } from '../agente-modo';
import { processarMensagem, type ContextoAssistente } from '../assistente/chat';

const ACOES: AcaoRapida[] = [
  { label: 'Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } },
  { label: 'Contas', acao: 'NAVEGAR', payload: { rota: '/financas/contas?nova=1' } },
  { label: 'Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
  { label: 'Agenda', acao: 'CRIAR_COMPROMISSO', payload: { titulo: 'x', data_inicio: 'y' } },
  { label: 'Hábitos', acao: 'NAVEGAR', payload: { rota: '/habitos' } },
  { label: 'Pergunta', acao: 'COMANDO', payload: { comando: 'saldo' } },
];

describe('agente-modo (igual nos dois modos)', () => {
  it('abas: Chat e Alertas, sem Resumo', () => {
    expect(ABAS_AGENTE).toEqual(['treino', 'alertas']);
  });

  it('remove criar compromisso e navegação para rotas legadas; Treinos fica', () => {
    expect(filtrarAcoes(ACOES).map((a) => a.label)).toEqual(['Finanças', 'Contas', 'Treinos', 'Pergunta']);
    expect(isAcaoPermitida({ acao: 'NAVEGAR' })).toBe(false);
  });

  it('sugestões só navegam para rotas que existem', () => {
    expect(filtrarAcoes(SUGESTOES_AGENTE)).toEqual(SUGESTOES_AGENTE);
  });

  it('mensagens antigas do chat perdem ações de módulos removidos', () => {
    const msg = { id: 'm', role: 'agent', conteudo: 'oi', acoes: [ACOES[0]!, ACOES[2]!, ACOES[5]!] } as MensagemChat;
    expect(filtrarMensagens([msg])[0]).toEqual(msg);
  });

  it('mensagem antiga que oferecia "Criar Agora" é reescrita (sem botão órfão)', () => {
    const msg = { id: 'm', role: 'agent', conteudo: 'Clique em "Criar Agora" para confirmar.', acoes: [ACOES[3]!] } as MensagemChat;
    const [r] = filtrarMensagens([msg]);
    expect(r!.conteudo).toMatch(/agenda .*não está disponível/);
    expect(r!.conteudo).not.toContain('Criar Agora');
    expect(r!.acoes).toEqual([]);
  });

  it('mensagem antiga com "Ver Hábitos" vira o aviso de hábitos; mensagem do usuário não muda', () => {
    const agente = { id: 'a', role: 'agent', conteudo: '3/5 hábitos', acoes: [ACOES[4]!] } as MensagemChat;
    const usuario = { id: 'u', role: 'user', conteudo: 'meus hábitos', acoes: null } as unknown as MensagemChat;
    const [a, u] = filtrarMensagens([agente, usuario]);
    expect(a!.conteudo).toMatch(/Hábitos não estão disponíveis/);
    expect(u!.conteudo).toBe('meus hábitos');
  });

  it('notificações: só as de finanças, sem ações para rotas legadas', () => {
    const n = (modulo: string, acoes: AcaoRapida[] = []) => ({ id: modulo, modulo, lida: false, acoes }) as unknown as NotificacaoAgente;
    const r = filtrarNotificacoes([n('financas', [ACOES[0]!, ACOES[4]!]), n('habitos'), n('agenda')]);
    expect(r.map((x) => x.modulo)).toEqual(['financas']);
    expect(r[0]!.acoes?.map((a) => a.label)).toEqual(['Finanças']);
  });
});

describe('respostas locais (lib/assistente) não oferecem módulos removidos', () => {
  const contexto: ContextoAssistente = {
    nome: 'Ana',
    horaAtual: 10,
    treinoHoje: null,
    sessoesSemana: 0,
    metaTreinosSemana: 0,
    saldoMes: 100,
    despesasMes: 50,
    receitasMes: 150,
  };

  it.each(['marcar reunião dia 15 às 10h', 'Adicione uma tarefa: comprar pão amanhã às 9h', 'o que tenho amanhã', 'criar compromisso', 'agenda treino para segunda'])(
    '"%s" diz que a agenda não está disponível, sem ação de agenda',
    (texto) => {
      const r = processarMensagem(texto, contexto);
      expect(r.mensagem).toMatch(/agenda \(compromissos e tarefas\) não está disponível no modo Finanças/);
      expect(r.mensagem).not.toContain('Criar Agora');
      expect(filtrarAcoes(r.acoes)).toEqual(r.acoes);
    },
  );

  it.each(['cria um treino de peito', 'qual meu treino de hoje'])('"%s" responde sobre treino (sem aviso de indisponível)', (texto) => {
    const r = processarMensagem(texto, contexto);
    expect(r.mensagem).not.toMatch(/não está disponível|não estão disponíveis/);
    expect(r.mensagem).toMatch(/[Tt]reino|descanso/);
  });

  it('"cria um treino de peito" leva para Treinos', () => {
    const r = processarMensagem('cria um treino de peito', contexto);
    expect(r.mensagem).toBe('Para criar um treino de peito (nível intermediário), vá até a página de Treinos e use o botão de adicionar.');
    expect(r.acoes).toEqual([{ label: 'Ir para Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } }]);
  });

  it.each([
    ['criar hábito de ler', /Hábitos não estão disponíveis/],
    ['como estão meus hábitos?', /Hábitos não estão disponíveis/],
    ['abrir minhas notas', /Notas não estão disponíveis/],
  ])('"%s" avisa o módulo indisponível', (texto, esperado) => {
    expect(processarMensagem(texto, contexto).mensagem).toMatch(esperado);
  });

  it('finanças: resumo do mês e ações que existem', () => {
    const r = processarMensagem('como estão minhas finanças?', contexto);
    expect(r.mensagem).toBe('Saldo do mês: R$ 100.00. Gastos em 33% da receita.');
    expect(filtrarAcoes(r.acoes)).toEqual(r.acoes);
  });

  it.each(['oi', 'resumo do dia', 'blablabla', 'quero ver a rotina', 'gastei 45 no mercado', 'recebi 100'])(
    '"%s": nenhuma ação para rota legada',
    (texto) => {
      const r = processarMensagem(texto, contexto);
      expect(filtrarAcoes(r.acoes)).toEqual(r.acoes ?? []);
      expect(r.mensagem).not.toMatch(/[Hh]ábitos —|Agenda —/);
    },
  );

  it('continuação: "gasto" depois de "gasto ou receita?" registra despesa', () => {
    const historico = [
      { role: 'user', conteudo: 'mercado 50' },
      { role: 'agent', conteudo: 'Valor: R$ 50. É um gasto ou receita?' },
    ];
    expect(processarMensagem('gasto', contexto, historico).mensagem).toMatch(/Para registrar uma transação/);
  });
});
