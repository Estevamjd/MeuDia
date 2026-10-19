/**
 * Mapa único de categorias (R13): nome → ícone (id do lucide-react) + cor.
 * O web resolve o id para o componente; qualquer nome desconhecido/legado cai em "Outros".
 */
export type IconeCategoria =
  | 'shopping-cart' | 'utensils' | 'utensils-crossed' | 'bus' | 'fuel' | 'house' | 'lightbulb'
  | 'droplets' | 'wifi' | 'smartphone' | 'tv' | 'dumbbell' | 'pill' | 'book-open' | 'graduation-cap'
  | 'paintbrush' | 'eye' | 'sparkles' | 'scissors' | 'shirt' | 'paw-print' | 'gift' | 'party-popper' | 'plane'
  | 'sofa' | 'school' | 'repeat' | 'receipt' | 'wallet' | 'hand-coins' | 'scale' | 'tag';

/** `gasto`: aparece nos seletores de gasto/conta; `entrada`/`sistema`: criadas pelo app. */
export type GrupoCategoria = 'gasto' | 'entrada' | 'sistema';

export interface CategoriaInfo {
  nome: string;
  icone: IconeCategoria;
  /** Cor do ícone (fundo = a mesma cor com transparência). Legível sobre o card escuro. */
  cor: string;
  grupo: GrupoCategoria;
  /** Nomes antigos/variações que caem nesta categoria (comparação sem acento e sem caixa). */
  aliases?: readonly string[];
}

export const CATEGORIA_OUTROS = 'Outros';
export const CATEGORIA_SALARIO = 'Salário';
export const CATEGORIA_ENTRADA_EXTRA = 'Entrada extra';
export const CATEGORIA_AJUSTE = 'Ajuste de saldo';

export const CATEGORIAS: readonly CategoriaInfo[] = [
  { nome: 'Mercado', icone: 'shopping-cart', cor: '#4ade80', grupo: 'gasto', aliases: ['Supermercado', 'Feira'] },
  { nome: 'Comida', icone: 'utensils', cor: '#fb923c', grupo: 'gasto', aliases: ['Lanche', 'Comida/Lanche', 'Alimentação', 'Alimentacao', 'Delivery'] },
  { nome: 'Restaurante', icone: 'utensils-crossed', cor: '#f97316', grupo: 'gasto' },
  { nome: 'Transporte', icone: 'bus', cor: '#38bdf8', grupo: 'gasto', aliases: ['Uber', 'Ônibus'] },
  { nome: 'Combustível', icone: 'fuel', cor: '#facc15', grupo: 'gasto', aliases: ['Gasolina'] },
  { nome: 'Aluguel', icone: 'house', cor: '#a78bfa', grupo: 'gasto', aliases: ['Moradia'] },
  { nome: 'Luz', icone: 'lightbulb', cor: '#fde047', grupo: 'gasto', aliases: ['Energia'] },
  { nome: 'Água', icone: 'droplets', cor: '#60a5fa', grupo: 'gasto' },
  { nome: 'Internet', icone: 'wifi', cor: '#22d3ee', grupo: 'gasto' },
  { nome: 'Celular', icone: 'smartphone', cor: '#818cf8', grupo: 'gasto', aliases: ['Telefone'] },
  { nome: 'Streaming', icone: 'tv', cor: '#f472b6', grupo: 'gasto', aliases: ['Netflix', 'Spotify'] },
  { nome: 'Academia', icone: 'dumbbell', cor: '#fb7185', grupo: 'gasto' },
  { nome: 'Saúde', icone: 'pill', cor: '#34d399', grupo: 'gasto', aliases: ['Farmácia', 'Saúde/Farmácia', 'Remédio'] },
  { nome: 'Curso', icone: 'book-open', cor: '#c084fc', grupo: 'gasto' },
  { nome: 'Faculdade', icone: 'graduation-cap', cor: '#a5b4fc', grupo: 'gasto' },
  { nome: 'Unha', icone: 'paintbrush', cor: '#f9a8d4', grupo: 'gasto', aliases: ['Manicure'] },
  // Sobrancelha virou categoria própria (decisão 2); "Sobrancelha/Estética" (legado) segue em Estética.
  { nome: 'Sobrancelha', icone: 'eye', cor: '#d8b4fe', grupo: 'gasto', aliases: ['Design de sobrancelha'] },
  { nome: 'Estética', icone: 'sparkles', cor: '#e879f9', grupo: 'gasto', aliases: ['Sobrancelha/Estética'] },
  { nome: 'Cabelo', icone: 'scissors', cor: '#fda4af', grupo: 'gasto', aliases: ['Salão'] },
  { nome: 'Roupa', icone: 'shirt', cor: '#93c5fd', grupo: 'gasto', aliases: ['Roupas', 'Vestuário'] },
  { nome: 'Pet', icone: 'paw-print', cor: '#d6a36f', grupo: 'gasto' },
  { nome: 'Presente', icone: 'gift', cor: '#f87171', grupo: 'gasto', aliases: ['Presentes'] },
  { nome: 'Lazer', icone: 'party-popper', cor: '#fbbf24', grupo: 'gasto' },
  { nome: 'Viagem', icone: 'plane', cor: '#7dd3fc', grupo: 'gasto' },
  { nome: 'Casa', icone: 'sofa', cor: '#c4b5fd', grupo: 'gasto' },
  { nome: 'Educação', icone: 'school', cor: '#a3e635', grupo: 'gasto' },
  { nome: 'Assinaturas', icone: 'repeat', cor: '#7c6aff', grupo: 'gasto', aliases: ['Assinatura'] },
  { nome: 'Contas', icone: 'receipt', cor: '#94a3b8', grupo: 'gasto' },
  { nome: CATEGORIA_OUTROS, icone: 'tag', cor: '#a1a1b5', grupo: 'gasto' },
  { nome: CATEGORIA_SALARIO, icone: 'wallet', cor: '#4ade80', grupo: 'entrada', aliases: ['Renda'] },
  { nome: CATEGORIA_ENTRADA_EXTRA, icone: 'hand-coins', cor: '#6affda', grupo: 'entrada', aliases: ['Entrada', 'Extra', 'Freela'] },
  { nome: CATEGORIA_AJUSTE, icone: 'scale', cor: '#a1a1b5', grupo: 'sistema' },
];

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const POR_NOME = new Map<string, CategoriaInfo>();
for (const c of CATEGORIAS) {
  for (const n of [c.nome, ...(c.aliases ?? [])]) POR_NOME.set(normalizar(n), c);
}

const OUTROS = POR_NOME.get(normalizar(CATEGORIA_OUTROS))!;

/** Categoria do mapa para um nome qualquer; desconhecida, vazia ou legada → "Outros". */
export function categoriaInfo(nome: string | null | undefined): CategoriaInfo {
  return (nome && POR_NOME.get(normalizar(nome))) || OUTROS;
}

/** Categorias oferecidas em "Gastei" e no cadastro de contas/assinaturas. */
export const CATEGORIAS_GASTO: readonly CategoriaInfo[] = CATEGORIAS.filter((c) => c.grupo === 'gasto');
