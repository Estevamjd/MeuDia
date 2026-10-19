import { hojeSP } from '@meudia/shared';

/**
 * "Baixar meus dados" (CSV). Função pura: recebe as linhas cruas do PostgREST e devolve um CSV único com a coluna
 * `tabela`. Só colunas de negócio listadas aqui saem; ids, user_id, chaves de idempotência e push nunca.
 * Formato para o Excel pt-BR (e o Numbers): UTF-8 com BOM, `;`, decimal com vírgula, datas AAAA-MM-DD, CRLF.
 */

type Linha = Record<string, unknown>;
type TipoCampo = 'texto' | 'dinheiro' | 'inteiro' | 'data' | 'bool';

export interface DadosExportacao {
  transacoes: Linha[];
  carteiras: Linha[];
  transferencias: Linha[];
  rendas: Linha[];
  recebimentos_renda: Linha[];
  contas_pagar: Linha[];
  pagamentos_conta: Linha[];
  orcamento_categorias: Linha[];
  metas: Linha[];
}
export type TabelaExportada = keyof DadosExportacao;

/** Coluna do CSV → tipo e como ler da linha (com os nomes já resolvidos). */
type Coluna = readonly [nome: string, tipo: TipoCampo, ler: (r: Linha, nomes: Nomes) => unknown];
interface Nomes {
  carteira: Map<unknown, unknown>;
  renda: Map<unknown, unknown>;
  conta: Map<unknown, unknown>;
}

const col = (nome: string, tipo: TipoCampo, campo = nome): Coluna => [nome, tipo, (r) => r[campo]];

const DEFINICAO: { [T in TabelaExportada]: readonly Coluna[] } = {
  transacoes: [
    col('data', 'data'), col('tipo', 'texto'), col('descricao', 'texto'), col('categoria', 'texto'), col('valor', 'dinheiro'),
    // Banco/carteira: o nome atual da carteira; lançamento antigo (sem carteira) usa o texto `banco`.
    ['banco', 'texto', (r, n) => n.carteira.get(r.carteira_id) ?? r.banco],
  ],
  carteiras: [
    col('nome', 'texto'), col('tipo', 'texto'), col('saldo_inicial', 'dinheiro'), col('saldo_inicial_em', 'data'),
    col('incluir_no_total', 'bool'), col('arquivada', 'bool'),
  ],
  transferencias: [
    col('data', 'data'), col('valor', 'dinheiro'), col('descricao', 'texto'),
    ['origem', 'texto', (r, n) => n.carteira.get(r.origem_id)],
    ['destino', 'texto', (r, n) => n.carteira.get(r.destino_id)],
  ],
  rendas: [
    col('descricao', 'texto'), col('valor', 'dinheiro'), col('dia_recebimento', 'inteiro'), col('ativo', 'bool'),
    ['banco', 'texto', (r, n) => n.carteira.get(r.carteira_id)],
  ],
  recebimentos_renda: [
    col('competencia', 'texto'), col('recebido_em', 'data'),
    ['renda', 'texto', (r, n) => n.renda.get(r.renda_id)],
  ],
  contas_pagar: [
    col('descricao', 'texto'), col('categoria', 'texto'), col('valor', 'dinheiro'), col('recorrencia', 'texto'),
    col('dia_vencimento', 'inteiro'), col('mes_vencimento', 'inteiro'), col('data_vencimento', 'data'), col('ativo', 'bool'),
  ],
  pagamentos_conta: [
    col('competencia', 'texto'), col('pago_em', 'data'),
    ['conta', 'texto', (r, n) => n.conta.get(r.conta_id)],
  ],
  orcamento_categorias: [col('categoria', 'texto'), col('valor_planejado', 'dinheiro')],
  metas: [
    col('nome', 'texto'), col('icone', 'texto'), col('valor_alvo', 'dinheiro'), col('valor_guardado', 'dinheiro'),
    col('data_limite', 'data'),
  ],
};

export const TABELAS_EXPORTADAS = Object.keys(DEFINICAO) as TabelaExportada[];
export const COLUNAS_EXPORTADAS = Object.fromEntries(
  TABELAS_EXPORTADAS.map((t) => [t, DEFINICAO[t].map(([nome]) => nome)]),
) as { [T in TabelaExportada]: string[] };

/** Colunas que a rota precisa ler (negócio + chaves para resolver nomes). Nada além disso sai do banco. */
export const SELECT_EXPORTACAO: { [T in TabelaExportada]: string } = {
  transacoes: 'id,user_id,data,tipo,descricao,categoria,valor,banco,carteira_id',
  carteiras: 'id,user_id,nome,tipo,saldo_inicial,saldo_inicial_em,incluir_no_total,arquivada',
  transferencias: 'id,user_id,data,valor,descricao,origem_id,destino_id',
  rendas: 'id,user_id,descricao,valor,dia_recebimento,ativo,carteira_id',
  recebimentos_renda: 'id,user_id,competencia,recebido_em,renda_id',
  contas_pagar: 'id,user_id,descricao,categoria,valor,recorrencia,dia_vencimento,mes_vencimento,data_vencimento,ativo',
  pagamentos_conta: 'id,user_id,competencia,pago_em,conta_id',
  orcamento_categorias: 'id,user_id,categoria,valor_planejado',
  metas: 'id,user_id,nome,icone,valor_alvo,valor_guardado,data_limite',
};

const BOM = '\uFEFF';
const FORMULA = /^[=+\-@\t\r]/;

/** Um campo já formatado e escapado (RFC 4180). Texto que parece fórmula ganha `'` (números não). */
export function campoCsv(valor: unknown, tipo: TipoCampo): string {
  if (valor === null || valor === undefined || valor === '') return '';
  let s: string;
  switch (tipo) {
    case 'dinheiro': {
      const n = Number(valor);
      s = Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '';
      break;
    }
    case 'inteiro': {
      const n = Number(valor);
      s = Number.isFinite(n) ? String(Math.trunc(n)) : '';
      break;
    }
    case 'data': {
      const v = String(valor);
      // DATE já vem AAAA-MM-DD; TIMESTAMPTZ vira o dia em São Paulo.
      s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : Number.isNaN(Date.parse(v)) ? '' : hojeSP(new Date(v));
      break;
    }
    case 'bool':
      s = valor ? 'sim' : 'não';
      break;
    default:
      s = String(valor);
      if (FORMULA.test(s)) s = `'${s}`;
  }
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function gerarCsvExportacao(dados: DadosExportacao): string {
  const mapa = (rows: Linha[], campo: string) => new Map(rows.map((r) => [r.id, r[campo]]));
  const nomes: Nomes = {
    carteira: mapa(dados.carteiras, 'nome'),
    renda: mapa(dados.rendas, 'descricao'),
    conta: mapa(dados.contas_pagar, 'descricao'),
  };
  // Cabeçalho único: `tabela` + colunas na ordem em que aparecem (colunas de mesmo nome são compartilhadas).
  const cabecalho = ['tabela', ...new Set(TABELAS_EXPORTADAS.flatMap((t) => COLUNAS_EXPORTADAS[t]))];
  const posicao = new Map(cabecalho.map((c, i) => [c, i]));
  const linhas = [cabecalho.join(';')];
  for (const tabela of TABELAS_EXPORTADAS) {
    // A leitura pagina por id (estável); no arquivo, o que tem data sai em ordem cronológica.
    const rows = COLUNAS_EXPORTADAS[tabela].includes('data')
      ? [...dados[tabela]].sort((a, b) => String(a.data ?? '').localeCompare(String(b.data ?? '')))
      : dados[tabela];
    for (const r of rows) {
      const campos = new Array<string>(cabecalho.length).fill('');
      campos[0] = tabela;
      for (const [nome, tipo, ler] of DEFINICAO[tabela]) campos[posicao.get(nome)!] = campoCsv(ler(r, nomes), tipo);
      linhas.push(campos.join(';'));
    }
  }
  return BOM + linhas.join('\r\n') + '\r\n';
}

/** `meudia-dados-AAAA-MM-DD.csv` com o dia de hoje em São Paulo. */
export function nomeArquivoExportacao(agora = new Date()): string {
  return `meudia-dados-${hojeSP(agora)}.csv`;
}

/**
 * Uma página de uma tabela, já filtrada por `user_id`: linhas com `id` > `aposId` (ou do começo, se `null`), em ordem
 * de `id`, no máximo `limite`. A rota implementa com o supabase-js (`eq`, `gt`, `order('id')`, `limit`).
 */
export type LerPagina = (tabela: TabelaExportada, colunas: string, userId: string, aposId: string | null, limite: number)
  => PromiseLike<{ data: Linha[] | null; error: unknown }>;

/** Pedido por página; o `max-rows` do projeto pode devolver menos, e tudo bem (só a página vazia encerra). */
const LOTE = 1000;

/**
 * Lê as 9 tabelas do usuário. Filtra `user_id` explicitamente (além da RLS) e descarta qualquer linha de outro
 * usuário que viesse mesmo assim. Erro em qualquer tabela derruba a exportação inteira (sem CSV parcial).
 * Paginação por chave (`id` > último lido, como `paginasPorChave` em cron-pagination.ts, mas só por `id`, que toda
 * tabela exportada tem): exclusão ou inserção entre páginas não faz pular linha, e só a página vazia encerra,
 * então um `max-rows` menor que `LOTE` encurta as páginas sem truncar o resultado.
 */
export async function buscarDadosExportacao(lerPagina: LerPagina, userId: string): Promise<DadosExportacao> {
  const lerTabela = async (tabela: TabelaExportada) => {
    const linhas: Linha[] = [];
    for (let aposId: string | null = null; ;) {
      const { data, error } = await lerPagina(tabela, SELECT_EXPORTACAO[tabela], userId, aposId, LOTE);
      if (error) throw new Error(`exportar: falha ao ler ${tabela}`);
      if (!data?.length) return linhas;
      linhas.push(...data.filter((r) => r.user_id === userId));
      aposId = String(data[data.length - 1]!.id);
    }
  };
  const lidas = await Promise.all(TABELAS_EXPORTADAS.map(async (t) => [t, await lerTabela(t)] as const));
  return Object.fromEntries(lidas) as unknown as DadosExportacao;
}
