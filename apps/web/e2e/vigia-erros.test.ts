import { describe, expect, it } from 'vitest';
import { errosQueReprovam, type EventoVigia } from './vigia-erros';

/**
 * Filtro de erros dos E2E da Wave 3A (`e2e/vigia-erros.ts`), sem navegador: o registro de eventos na ordem em que o
 * Playwright os entrega. A ligação com o WebKit de verdade está em `vigia-erros.ritmo-busca-parcelas.spec.ts`.
 */
const REST = 'http://127.0.0.1:54329/rest/v1/transacoes?select=*&user_id=eq.u1';
const RSC = 'http://localhost:3105/financas/gastos?_rsc=abc12';
// Como chega do Playwright: ele parte a mensagem do WebKit no 1º ":" (name "Fetch API cannot load http", message "//…").
const cors = (url: string) => `Fetch API cannot load ${url.replace('http://', 'http: //')} due to access control checks.`;

const ini = (doc: string): EventoVigia => ({ tipo: 'doc-inicio', doc });
const sai = (doc: string): EventoVigia => ({ tipo: 'doc-saida', doc });
const erro = (msg: string): EventoVigia => ({ tipo: 'erro', msg });
const falha = (url: string, cancelada = false): EventoVigia => ({ tipo: 'falha', url, cancelada });
const GI: EventoVigia = { tipo: 'goto-inicio' };
const GF: EventoVigia = { tipo: 'goto-fim' };

describe('errosQueReprovam', () => {
  it('cancelamento de verdade do documento antigo é ignorado (ordem medida no WebKit: erro, pagehide do antigo, novo)', () => {
    expect(errosQueReprovam([ini('A'), GI, erro(cors(REST)), sai('A'), ini('B'), GF])).toEqual([]);
  });

  it('erro entre o pagehide do antigo e o inicio do novo também é do antigo', () => {
    expect(errosQueReprovam([ini('A'), GI, sai('A'), erro(cors(REST)), ini('B'), GF])).toEqual([]);
  });

  it('prefetch RSC do documento antigo cancelado na rede no mesmo goto é ignorado', () => {
    expect(errosQueReprovam([ini('A'), GI, sai('A'), falha(RSC, true), erro(cors(RSC)), ini('B'), GF])).toEqual([]);
  });

  it('erro do documento NOVO durante o goto reprova (chega depois do inicio dele)', () => {
    expect(errosQueReprovam([ini('A'), GI, sai('A'), ini('B'), erro(cors(REST)), GF])).toEqual([cors(REST)]);
  });

  it('erro do documento novo logo depois do commit reprova, sem folga de tempo', () => {
    // Antes havia 250 ms de tolerância depois do commit; agora só a ordem em relação ao "inicio" do novo decide.
    expect(errosQueReprovam([ini('A'), GI, sai('A'), ini('B'), erro(cors(REST)), erro(cors(RSC)), falha(RSC, true), GF])).toEqual([
      cors(REST),
      cors(RSC),
    ]);
  });

  it('falha de rede da mesma URL DEPOIS do goto reprova o erro que parecia cancelamento', () => {
    expect(errosQueReprovam([ini('A'), GI, sai('A'), erro(cors(REST)), ini('B'), GF, falha(REST)])).toEqual([cors(REST)]);
  });

  it('falha de rede da mesma URL antes do goto também reprova', () => {
    expect(errosQueReprovam([ini('A'), falha(REST), GI, sai('A'), erro(cors(REST)), ini('B'), GF])).toEqual([cors(REST)]);
  });

  it('erro depois que o goto terminou reprova', () => {
    expect(errosQueReprovam([ini('A'), GI, sai('A'), ini('B'), GF, erro(cors(REST))])).toEqual([cors(REST)]);
  });

  it('sem o pagehide do documento antigo no goto (sem prova de que ele foi desmontado) reprova', () => {
    expect(errosQueReprovam([ini('A'), GI, erro(cors(REST)), ini('B'), GF])).toEqual([cors(REST)]);
    // goto que não troca de documento (falhou ou terminou sem navegar)
    expect(errosQueReprovam([ini('A'), GI, erro(cors(REST)), GF])).toEqual([cors(REST)]);
  });

  it('pagehide do antigo só depois do documento novo começar não vale', () => {
    expect(errosQueReprovam([ini('A'), GI, erro(cors(REST)), ini('B'), sai('A'), GF])).toEqual([cors(REST)]);
  });

  it('saída de outro documento que não o aberto no início do goto não vale', () => {
    expect(errosQueReprovam([ini('A'), GI, sai('X'), erro(cors(REST)), ini('B'), GF])).toEqual([cors(REST)]);
  });

  it('navegação que não é do teste (location.assign: pagehide sem goto) reprova', () => {
    expect(errosQueReprovam([ini('A'), sai('A'), erro(cors(REST)), ini('B')])).toEqual([cors(REST)]);
  });

  it('prefetch RSC na fila do documento antigo (sem request na rede, como o REST) é ignorado', () => {
    expect(errosQueReprovam([ini('A'), GI, erro(cors(RSC)), sai('A'), ini('B'), GF])).toEqual([]);
  });

  it('RSC com falha de rede que não é cancelamento, ou cancelado só em outro goto, reprova', () => {
    expect(errosQueReprovam([ini('A'), GI, erro(cors(RSC)), sai('A'), ini('B'), GF, falha(RSC)])).toEqual([cors(RSC)]);
    expect(
      errosQueReprovam([ini('A'), GI, falha(RSC, true), sai('A'), ini('B'), GF, GI, erro(cors(RSC)), sai('B'), ini('C'), GF]),
    ).toEqual([cors(RSC)]);
  });

  it('RSC cancelado no mesmo goto, mas com falha REAL (não cancelamento) da mesma URL ANTES do goto, reprova', () => {
    expect(
      errosQueReprovam([ini('A'), falha(RSC), GI, sai('A'), falha(RSC, true), erro(cors(RSC)), ini('B'), GF]),
    ).toEqual([cors(RSC)]);
  });

  it('RSC cancelado no mesmo goto, mas com falha REAL da mesma URL DEPOIS do goto, reprova', () => {
    expect(
      errosQueReprovam([ini('A'), GI, sai('A'), falha(RSC, true), erro(cors(RSC)), ini('B'), GF, falha(RSC)]),
    ).toEqual([cors(RSC)]);
  });

  it('RSC só com o cancelamento no mesmo goto (sem falha real em lugar nenhum) segue ignorado', () => {
    expect(
      errosQueReprovam([ini('A'), GI, sai('A'), falha(RSC, true), erro(cors(RSC)), ini('B'), GF, GI, sai('B'), ini('C'), GF]),
    ).toEqual([]);
  });

  it('RSC do documento novo reprova mesmo cancelado na rede no mesmo goto', () => {
    expect(errosQueReprovam([ini('A'), GI, sai('A'), ini('B'), falha(RSC, true), erro(cors(RSC)), GF])).toEqual([cors(RSC)]);
  });

  it('outra mensagem ou outra origem reprova mesmo na janela do documento antigo', () => {
    const outra = 'TypeError: Load failed';
    const outraOrigem = cors('http://127.0.0.1:9999/rest/v1/x');
    expect(errosQueReprovam([ini('A'), GI, sai('A'), erro(outra), erro(outraOrigem), ini('B'), GF])).toEqual([outra, outraOrigem]);
  });

  it('cada goto tem a própria janela: o pagehide de um goto anterior não vale para o seguinte', () => {
    expect(errosQueReprovam([ini('A'), GI, sai('A'), ini('B'), GF, GI, erro(cors(REST)), ini('C'), GF])).toEqual([cors(REST)]);
  });
});
