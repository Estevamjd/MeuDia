import { describe, expect, it } from 'vitest';
import { COLUNAS_EXPORTADAS, campoCsv, gerarCsvExportacao, nomeArquivoExportacao, type DadosExportacao } from '../exportar-dados';

const U = 'user-a';
const vazio: DadosExportacao = {
  transacoes: [], carteiras: [], transferencias: [], rendas: [], recebimentos_renda: [],
  contas_pagar: [], pagamentos_conta: [], orcamento_categorias: [], metas: [],
};
/** Linhas cruas como o PostgREST devolve, inclusive colunas que NUNCA podem sair no CSV. */
const dados: DadosExportacao = {
  ...vazio,
  carteiras: [{ id: 'cart-1', user_id: U, nome: 'Nubank', tipo: 'banco', saldo_inicial: -12.5, saldo_inicial_em: '2026-10-01T02:30:00Z', incluir_no_total: true, arquivada: false, ordem: 0 }],
  transacoes: [
    { id: 't1', user_id: U, data: '2026-10-17', tipo: 'despesa', descricao: 'Mercado; feira "do bairro"', categoria: 'Mercado', valor: 1234.5, banco: null, carteira_id: 'cart-1', ajuste: false, chave_ajuste: 'chave-secreta-1', ajuste_valor_real: null },
    { id: 't2', user_id: U, data: '2026-10-18', tipo: 'despesa', descricao: '=HYPERLINK("http://x")', categoria: 'Sobrancelha', valor: 45, banco: 'Itaú', carteira_id: null, ajuste: false, chave_ajuste: null },
    { id: 't3', user_id: U, data: '2026-10-19', tipo: 'receita', descricao: 'linha 1\nlinha 2', categoria: '+Extra', valor: 0.1, banco: null, carteira_id: null },
  ],
  transferencias: [{ id: 'tr', user_id: U, origem_id: 'cart-1', destino_id: null, valor: 10, data: '2026-10-02', descricao: '@nota' }],
  rendas: [{ id: 'r1', user_id: U, descricao: 'Salário', valor: 943, dia_recebimento: 5, ativo: true, carteira_id: 'cart-1' }],
  recebimentos_renda: [{ id: 'rec', user_id: U, renda_id: 'r1', competencia: '2026-10', recebido_em: '2026-10-05', transacao_id: 't3' }],
  contas_pagar: [{ id: 'c1', user_id: U, descricao: 'Luz', categoria: 'Luz', valor: 180, recorrencia: 'mensal', dia_vencimento: 10, mes_vencimento: null, data_vencimento: null, ativo: true, assinatura_id: 'a' }],
  pagamentos_conta: [{ id: 'p1', user_id: U, conta_id: 'c1', competencia: '2026-10', pago_em: '2026-10-10', transacao_id: 't1' }],
  orcamento_categorias: [{ id: 'o', user_id: U, categoria: 'Lazer', valor_planejado: 200 }],
  metas: [{ id: 'm', user_id: U, nome: 'Viagem', icone: 'plane', valor_alvo: 3000, valor_guardado: 500.25, data_limite: '2027-01-31' }],
};

const linhas = (csv: string) => csv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);

describe('gerarCsvExportacao', () => {
  const csv = gerarCsvExportacao(dados);

  it('começa com BOM UTF-8 e usa ";" como separador e CRLF entre linhas', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(Buffer.from(csv, 'utf8').subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const [cabecalho] = linhas(csv);
    expect(cabecalho!.split(';')[0]).toBe('tabela');
    expect(cabecalho).not.toContain(',');
    expect(csv).toContain('\r\n');
  });

  it('cabeçalho único: coluna "tabela" + colunas de negócio (nada proibido)', () => {
    const cabecalho = linhas(csv)[0]!.split(';');
    for (const proibida of ['user_id', 'id', 'chave_ajuste', 'ajuste_valor_real', 'transacao_id', 'carteira_id', 'renda_id', 'conta_id', 'assinatura_id', 'origem_id', 'destino_id', 'endpoint', 'p256dh', 'auth', 'ordem']) {
      expect(cabecalho, proibida).not.toContain(proibida);
    }
    const todas = new Set(Object.values(COLUNAS_EXPORTADAS).flat());
    expect(cabecalho).toEqual(['tabela', ...todas]);
  });

  it('tem as 9 tabelas pedidas e nenhuma outra (push_subscriptions nunca)', () => {
    expect(Object.keys(COLUNAS_EXPORTADAS).sort()).toEqual(
      ['carteiras', 'contas_pagar', 'metas', 'orcamento_categorias', 'pagamentos_conta', 'rendas', 'recebimentos_renda', 'transacoes', 'transferencias'].sort(),
    );
    expect(COLUNAS_EXPORTADAS.transacoes).toEqual(['data', 'tipo', 'descricao', 'categoria', 'valor', 'banco']);
  });

  it('nenhum id, user_id ou chave de idempotência vaza nos valores', () => {
    for (const segredo of [U, 'chave-secreta-1', 'cart-1', 't1', 'rec', 'p1', 'c1', 'r1']) {
      expect(csv.split(/[;\r\n]/), segredo).not.toContain(segredo);
    }
    expect(csv).not.toContain('chave-secreta-1');
    expect(csv).not.toContain(U);
  });

  it('decimal com vírgula e 2 casas; negativo sem aspas nem apóstrofo (número não passa pelo filtro de fórmula)', () => {
    const t1 = linhas(csv).find((l) => l.startsWith('transacoes;2026-10-17'))!;
    expect(t1).toContain(';1234,50;');
    expect(linhas(csv).find((l) => l.startsWith('transacoes;2026-10-19'))).toContain(';0,10;');
    const carteira = linhas(csv).find((l) => l.startsWith('carteiras;'))!;
    expect(carteira).toContain(';-12,50;');
    expect(carteira).not.toContain("'-12,50");
  });

  it('datas AAAA-MM-DD (timestamptz vira a data em São Paulo)', () => {
    const carteira = linhas(csv).find((l) => l.startsWith('carteiras;'))!;
    // 2026-10-01T02:30Z = 30/09 23:30 em SP.
    expect(carteira).toContain(';2026-09-30;');
    expect(csv).toContain(';2027-01-31');
  });

  it('banco do lançamento vem do nome da carteira, ou do texto antigo; transferência com nomes', () => {
    expect(linhas(csv).find((l) => l.startsWith('transacoes;2026-10-17'))).toContain(';Nubank;');
    expect(linhas(csv).find((l) => l.startsWith('transacoes;2026-10-18'))).toContain(';Itaú;');
    const tr = linhas(csv).find((l) => l.startsWith('transferencias;'))!;
    expect(tr).toContain('Nubank');
    expect(csv).toContain('recebimentos_renda;');
    expect(linhas(csv).find((l) => l.startsWith('recebimentos_renda;'))).toContain('Salário');
    expect(linhas(csv).find((l) => l.startsWith('pagamentos_conta;'))).toContain('Luz');
  });

  it('escape RFC 4180: ";", aspas e quebra de linha entre aspas, aspas dobradas', () => {
    expect(csv).toContain('"Mercado; feira ""do bairro"""');
    expect(csv).toContain('"linha 1\nlinha 2"');
  });

  it('injeção de fórmula: texto com = + - @ tab ou CR no início ganha apóstrofo', () => {
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(";'+Extra;");
    expect(csv).toContain(";'@nota;");
    expect(campoCsv('-50', 'texto')).toBe("'-50");
    expect(campoCsv('\tx', 'texto')).toBe("'\tx");
    expect(campoCsv('\rx', 'texto')).toBe(`"'\rx"`);
    expect(campoCsv(-50, 'dinheiro')).toBe('-50,00');
    expect(campoCsv('Normal', 'texto')).toBe('Normal');
    expect(campoCsv(null, 'texto')).toBe('');
  });

  it('cada linha tem o mesmo número de colunas do cabeçalho', () => {
    const n = linhas(csv)[0]!.split(';').length;
    const simples = gerarCsvExportacao({ ...vazio, metas: dados.metas, orcamento_categorias: dados.orcamento_categorias });
    for (const l of linhas(simples)) expect(l.split(';').length).toBe(n);
  });

  it('sem dados: só o cabeçalho', () => {
    expect(linhas(gerarCsvExportacao(vazio))).toHaveLength(1);
  });
});

it('nome do arquivo: meudia-dados-AAAA-MM-DD.csv (dia em SP)', () => {
  expect(nomeArquivoExportacao(new Date('2026-10-20T02:00:00Z'))).toBe('meudia-dados-2026-10-19.csv');
  expect(nomeArquivoExportacao(new Date('2026-10-20T03:00:00Z'))).toBe('meudia-dados-2026-10-20.csv');
});
