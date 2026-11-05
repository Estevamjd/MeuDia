import { describe, expect, it } from 'vitest';
import type { Refeicao } from '@meudia/shared';
import { copiaRefeicao, linhaDoTempo, recorteHoje, resumoItens, totaisDosItens } from '../refeicoes-dia';

const r = (tipo: Refeicao['tipo'], id = `r-${tipo}`): Refeicao => ({
  id, user_id: 'u', tipo, data: '2026-11-02', items: [{ nome: 'arroz', calorias: 200 }], total_calorias: 200, total_proteina: 0, total_carbo: 0, total_gordura: 0,
});

describe('linha do tempo do dia (sem a 009: modelo + registros)', () => {
  it('6 horários do modelo; registrado = feita; pendente com itens do modelo sem valor', () => {
    const e = linhaDoTempo([r('cafe'), r('lanche_manha')]);
    expect(e.map((x) => `${x.horario} ${x.nome} ${x.feita ? 'feita' : '-'}`)).toEqual([
      '07:00 Café da manhã feita', '10:00 Lanche feita', '12:30 Almoço -', '17:00 Lanche da tarde -', '20:30 Vitamina -', '21:30 Jantar -',
    ]);
    const almoco = e[2]!;
    expect(almoco.itens.map((i) => i.nome)).toEqual(['arroz', 'feijão', 'frango', 'legumes']);
    expect(almoco.itens.every((i) => i.calorias === null)).toBe(true);
    expect(almoco.total).toBeNull();
  });

  it('refeição duplicada aparece duas vezes no mesmo horário, sem pendente daquele tipo', () => {
    const e = linhaDoTempo([r('almoco', 'a1'), r('almoco', 'a2')]);
    expect(e.filter((x) => x.tipo === 'almoco').map((x) => x.chave)).toEqual(['a1', 'a2']);
    expect(e).toHaveLength(7);
  });

  it('Hoje mostra até 4: duas antes da primeira pendente; tudo feito = as 4 últimas', () => {
    const duasFeitas = linhaDoTempo([r('cafe'), r('lanche_manha')]);
    expect(recorteHoje(duasFeitas).map((x) => x.horario)).toEqual(['07:00', '10:00', '12:30', '17:00']);
    const todas = linhaDoTempo(['cafe', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia'].map((t) => r(t as Refeicao['tipo'])));
    expect(recorteHoje(todas).map((x) => x.horario)).toEqual(['12:30', '17:00', '20:30', '21:30']);
    const cincoFeitas = linhaDoTempo(['cafe', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar'].map((t) => r(t as Refeicao['tipo'])));
    expect(recorteHoje(cincoFeitas).map((x) => x.horario)).toEqual(['12:30', '17:00', '20:30', '21:30']);
  });

  it('resumo dos itens no formato do caderno', () => {
    expect(resumoItens([{ nome: 'pão francês', calorias: null }, { nome: 'ovos', calorias: null }])).toBe('Pão francês · ovos');
    expect(resumoItens([])).toBe('Sem itens');
  });

  it('totais gravados somam só valores; sem valor não vira 0 nos itens', () => {
    expect(totaisDosItens([{ nome: 'a', calorias: 100.4, proteina: 3 }, { nome: 'b', calorias: null }])).toEqual({
      total_calorias: 100, total_proteina: 3, total_carbo: 0, total_gordura: 0,
    });
  });

  it('duplicar copia itens e totais, sem id', () => {
    const c = copiaRefeicao(r('cafe'));
    expect(c).not.toHaveProperty('id');
    expect(c).toMatchObject({ tipo: 'cafe', data: '2026-11-02', total_calorias: 200 });
  });
});
