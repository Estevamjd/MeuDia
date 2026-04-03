import { gerarResumoDiario } from '../resumo.generator';
import type { ContextoUsuario } from '@meudia/shared';

function baseContextoUsuario(overrides: Partial<ContextoUsuario> = {}): ContextoUsuario {
  return {
    userId: 'test-user',
    nome: 'João',
    objetivo: null,
    horaAtual: 10,
    diaSemana: 3,
    treinoHoje: null,
    sessoesSemana: 2,
    metaTreinosSemana: 5,
    habitosTotal: 5,
    habitosConcluidos: 2,
    habitosPendentes: ['Meditar', 'Ler', 'Água'],
    percentualHabitos: 40,
    compromissosHoje: 0,
    proximoCompromisso: null,
    saldoMes: 1000,
    despesasMes: 500,
    receitasMes: 1500,
    streakAtual: 3,
    scoreHoje: 50,
    ...overrides,
  };
}

describe('gerarResumoDiario', () => {
  it('gera um resumo com saudação', () => {
    const resumo = gerarResumoDiario(baseContextoUsuario());
    expect(resumo.saudacao).toBeTruthy();
    expect(typeof resumo.saudacao).toBe('string');
  });

  it('gera mensagem principal', () => {
    const resumo = gerarResumoDiario(baseContextoUsuario());
    expect(resumo.mensagemPrincipal).toBeTruthy();
    expect(resumo.mensagemPrincipal.length).toBeGreaterThan(10);
  });

  it('gera itens do resumo', () => {
    const resumo = gerarResumoDiario(baseContextoUsuario());
    expect(resumo.itens).toBeInstanceOf(Array);
    expect(resumo.itens.length).toBeGreaterThan(0);
    for (const item of resumo.itens) {
      expect(item.icone).toBeTruthy();
      expect(item.texto).toBeTruthy();
    }
  });

  it('prioridade é um valor válido', () => {
    const resumo = gerarResumoDiario(baseContextoUsuario());
    expect(['info', 'aviso', 'alerta']).toContain(resumo.prioridade);
  });

  it('inclui informação de treino quando tem treino hoje', () => {
    const resumo = gerarResumoDiario(
      baseContextoUsuario({
        treinoHoje: { nome: 'Peito e Tríceps', exercicios: 6, concluido: false },
      }),
    );
    const textos = resumo.itens.map((i) => i.texto).join(' ');
    expect(textos.toLowerCase()).toMatch(/treino|peito/i);
  });

  it('inclui informação de hábitos pendentes', () => {
    const resumo = gerarResumoDiario(
      baseContextoUsuario({
        habitosPendentes: ['Meditar', 'Ler'],
        habitosConcluidos: 3,
        habitosTotal: 5,
        percentualHabitos: 60,
      }),
    );
    const textos = resumo.itens.map((i) => i.texto).join(' ');
    expect(textos.toLowerCase()).toMatch(/h[aá]bito/i);
  });

  it('saudação varia com horário', () => {
    const manha = gerarResumoDiario(baseContextoUsuario({ horaAtual: 8 }));
    const noite = gerarResumoDiario(baseContextoUsuario({ horaAtual: 21 }));
    expect(manha.saudacao).not.toBe(noite.saudacao);
  });

  it('acoes é um array', () => {
    const resumo = gerarResumoDiario(baseContextoUsuario());
    expect(resumo.acoes).toBeInstanceOf(Array);
  });
});
