import { categoriaInfo, CATEGORIA_ENTRADA_EXTRA, CATEGORIA_OUTROS, CATEGORIA_SALARIO, refeicaoPelaHora, somarDias, type TipoRefeicaoRapida } from '@meudia/shared';
import { COMIDA } from './ganchos';
import type { Intencao } from './intencao';

/**
 * Parser por regras (grátis, sem rede). Cobre as frases do dia a dia; o que ele não entende vai para a IA
 * (se houver chave) ou vira a mensagem de ajuda.
 */

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** "45", "45,90", "R$ 1.200", "1.200,50", "12.5" → número; null se não houver valor. */
export function extrairValor(texto: string): { valor: number; trecho: string } | null {
  const m = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(?:reais|real|conto|contos|pila|pilas))?(?!\s*(?:min|minutos?|h\b|horas?|km|kg))/i.exec(texto);
  if (!m) return null;
  const bruto = m[1]!;
  const numero = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : /\.\d{3}$/.test(bruto) ? bruto.replace(/\./g, '') : bruto;
  const valor = Number(numero);
  return Number.isFinite(valor) && valor > 0 ? { valor: Math.round(valor * 100) / 100, trecho: m[0] } : null;
}

/** Palavras do dia a dia → categoria do app (o resto passa pelos aliases de `categoriaInfo`). */
const PALAVRAS_CATEGORIA: Record<string, string> = {
  ifood: 'Comida', padaria: 'Comida', lanche: 'Comida', pizza: 'Comida', hamburguer: 'Comida', acai: 'Comida', cafe: 'Comida',
  almoco: 'Restaurante', jantar: 'Restaurante', restaurante: 'Restaurante',
  uber: 'Transporte', '99': 'Transporte', onibus: 'Transporte', metro: 'Transporte', taxi: 'Transporte', estacionamento: 'Transporte',
  gasolina: 'Combustível', posto: 'Combustível', etanol: 'Combustível', combustivel: 'Combustível',
  farmacia: 'Saúde', remedio: 'Saúde', medico: 'Saúde', dentista: 'Saúde', consulta: 'Saúde',
  mercado: 'Mercado', supermercado: 'Mercado', feira: 'Mercado', atacadao: 'Mercado', hortifruti: 'Mercado',
  netflix: 'Streaming', spotify: 'Streaming', disney: 'Streaming', prime: 'Streaming', hbo: 'Streaming',
  luz: 'Luz', energia: 'Luz', agua: 'Água', internet: 'Internet', aluguel: 'Aluguel', condominio: 'Aluguel',
  celular: 'Celular', recarga: 'Celular', academia: 'Academia', roupa: 'Roupa', roupas: 'Roupa', tenis: 'Roupa',
  cabelo: 'Cabelo', salao: 'Cabelo', barbearia: 'Cabelo', unha: 'Unha', manicure: 'Unha', pet: 'Pet', racao: 'Pet', veterinario: 'Pet',
  presente: 'Presente', cinema: 'Lazer', bar: 'Lazer', show: 'Lazer', cerveja: 'Lazer', viagem: 'Viagem', passagem: 'Viagem', hotel: 'Viagem',
  curso: 'Curso', faculdade: 'Faculdade', livro: 'Educação',
};

export function categoriaDoTexto(texto: string, tipo: 'gasto' | 'entrada'): string {
  const palavras = semAcento(texto).split(/[^a-z0-9]+/).filter(Boolean);
  if (tipo === 'entrada') return palavras.some((p) => p === 'salario' || p === 'pagamento') ? CATEGORIA_SALARIO : CATEGORIA_ENTRADA_EXTRA;
  for (const p of palavras) {
    if (PALAVRAS_CATEGORIA[p]) return PALAVRAS_CATEGORIA[p]!;
    const info = categoriaInfo(p);
    if (info.nome !== CATEGORIA_OUTROS && info.grupo === 'gasto') return info.nome;
  }
  return CATEGORIA_OUTROS;
}

/** Tira conectivos da ponta: "no mercado" → "mercado". */
function limparDescricao(s: string): string {
  return s
    .replace(/\b(?:hoje|ontem)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:[:\-–,.]\s*)+/, '')
    .replace(/^(?:(?:no|na|nos|nas|em|de|do|da|dos|das|com|pro|pra|para|o|a|um|uma)\s+)+/i, '')
    .replace(/[.!]+$/, '')
    .trim();
}

const maiuscula = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function duracao(texto: string): { min: number | null; resto: string } {
  const h = /(\d{1,2})\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})?\s*(?:min(?:utos?)?)?\b/i.exec(texto);
  if (h) return { min: Number(h[1]) * 60 + (h[2] ? Number(h[2]) : 0), resto: texto.replace(h[0], ' ') };
  const m = /(\d{1,3})\s*(?:min|mins|minutos?|m)\b/i.exec(texto);
  if (m) return { min: Number(m[1]), resto: texto.replace(m[0], ' ') };
  return { min: null, resto: texto };
}

const VERBOS_TREINO: Record<string, string> = {
  treinei: '', malhei: '', corri: 'Corrida', caminhei: 'Caminhada', pedalei: 'Bike', nadei: 'Natação', 'fiz treino': '', 'fiz academia': '',
};

const VERBOS_REFEICAO: [RegExp, TipoRefeicaoRapida | null][] = [
  [/^(?:tomei\s+)?cafe(?:\s+da\s+manha)?\b/, 'cafe'],
  [/^almocei\b|^almoco\b/, 'almoco'],
  [/^lanchei\b|^lanche\b/, 'lanche'],
  [/^jantei\b|^janta(?:r)?\b/, 'jantar'],
  [/^ceia\b|^ceei\b/, 'ceia'],
  [/^comi\b/, null],
];

/** Frases que contam algo sobre a pessoa (viram fato guardado, não registro). */
const FATO_DECLARADO =
  /^(?:eu\s+)?(?:nao gosto|odeio|detesto|amo|adoro|prefiro|gosto (?:de|mais)|sou (?:alergic|intolerante|vegetarian|vegan|diabetic|celiac)|nao (?:como|bebo|tomo)|trabalho (?:de|a|em|no|na|como)|acordo|durmo|tenho (?:filh|alergia|intoler))/;

export interface ContextoRegras {
  hojeISO: string;
  horaSP: number;
}

export function interpretarPorRegras(mensagem: string, ctx: ContextoRegras): Intencao {
  const original = mensagem.trim().replace(/\s+/g, ' ');
  if (!original) return { tipo: 'desconhecido' };
  const t = semAcento(original);
  if (/^(?:ajuda|help|menu|oi|ola|bom dia|boa tarde|boa noite|\?|comandos?)\b[!.?\s]*$/.test(t)) return { tipo: 'ajuda' };

  // Memória curta: "lembra que não gosto de academia de manhã", "sou vegetariana", "esquece tudo".
  if (/^esquec[ea]r?\b.*\b(?:tudo|isso|o que (?:eu )?(?:te )?(?:disse|contei|falei))\b/.test(t)) return { tipo: 'esquecer' };
  const pedido = /^(?:lembra(?:r)?|lembre(?:-se)?|anota(?: ai)?|guarda(?: ai)?|grava(?: ai)?)\s+(?:(?:de|disso)\s*:?\s*)?(?:que\s+)?/.exec(t);
  if (pedido && original.length - pedido[0].length >= 3 && !extrairValor(original)) {
    return { tipo: 'lembrar', fato: maiuscula(original.slice(pedido[0].length).replace(/[.!]+$/, '').trim()).slice(0, 140) };
  }
  if (FATO_DECLARADO.test(t) && !/r\$|reais/.test(t) && original.length <= 140) {
    return { tipo: 'lembrar', fato: maiuscula(original.replace(/[.!]+$/, '')) };
  }

  const data = /\bontem\b/.test(t) ? somarDias(ctx.hojeISO, -1) : undefined;
  const comData = <T extends object>(o: T) => (data ? { ...o, data } : o);

  // Treino: "treinei peito 40min", "corri 5km 30 min"
  for (const [verbo, rotulo] of Object.entries(VERBOS_TREINO)) {
    if (t.startsWith(verbo)) {
      const { min, resto } = duracao(original.slice(verbo.length));
      const desc = limparDescricao(resto);
      const descricao = maiuscula([rotulo, desc].filter(Boolean).join(' ').trim()) || 'Treino';
      return comData({ tipo: 'treino' as const, descricao: descricao.slice(0, 120), duracao_min: min && min <= 600 ? min : null });
    }
  }

  // Refeição: "almocei arroz, feijão, frango", "café da manhã: pão e ovo", "comi uma maçã"
  for (const [re, tipo] of VERBOS_REFEICAO) {
    const m = re.exec(t);
    if (m) {
      const desc = limparDescricao(original.slice(m[0].length));
      if (!desc || extrairValor(desc)?.trecho.match(/r\$|reais/i)) break; // "almoço 35 reais" é gasto
      return comData({ tipo: 'refeicao' as const, refeicao: tipo ?? refeicaoPelaHora(ctx.horaSP), descricao: maiuscula(desc).slice(0, 200) });
    }
  }

  // "comprei um hambúrguer" / "pedi uma pizza" (sem valor) = o que comeu; com valor vira gasto (abaixo).
  const compra = /^(?:comprei|pedi|peguei|bebi|tomei)\b/.exec(t);
  if (compra && !extrairValor(original) && COMIDA.test(t)) {
    const desc = limparDescricao(original.slice(compra[0].length));
    if (desc) return comData({ tipo: 'refeicao' as const, refeicao: refeicaoPelaHora(ctx.horaSP), descricao: maiuscula(desc).slice(0, 200) });
  }

  // Dinheiro: "recebi 500 do freela", "gastei 45,90 no mercado", "uber 23"
  const valor = extrairValor(original);
  if (valor) {
    const entrada = /^(?:recebi|ganhei|entrou|caiu)\b/.test(t);
    const semVerbo = original.replace(/^(?:gastei|paguei|comprei|recebi|ganhei|entrou|caiu)\b/i, '');
    const desc = limparDescricao(semVerbo.replace(valor.trecho, ' '));
    const tipo = entrada ? 'entrada' : 'gasto';
    return comData({ tipo, valor: valor.valor, descricao: maiuscula(desc).slice(0, 200), categoria: categoriaDoTexto(desc, tipo) });
  }

  return { tipo: 'desconhecido' };
}
