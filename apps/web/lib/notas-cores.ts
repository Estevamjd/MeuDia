/**
 * Cores das notas. O `value` é o que fica salvo em notas.cor (não mudar: notas antigas usam esses nomes).
 * Antes "Amarelo" e "Laranja" usavam o mesmo #fab219 e "Roxo" era o ciano do app, tudo a 8% sobre o fundo escuro:
 * escolher Amarelo parecia não mudar nada. Agora cada cor tem um tom próprio (tokens nota-* no tailwind.config.ts),
 * a bolinha do seletor mostra a cor cheia e o cartão usa um tom visível nos dois temas.
 * As classes ficam escritas por inteiro aqui (lib/ está no `content` do Tailwind), nunca montadas com template.
 */
export interface CorNota {
  value: string;
  label: string;
  /** Bolinha do seletor: cor cheia. */
  swatch: string;
  /** Fundo e borda do cartão da nota. */
  bg: string;
  border: string;
}

export const CORES_NOTA: readonly CorNota[] = [
  { value: 'default', label: 'Padrão', swatch: 'bg-card', bg: 'bg-card', border: 'border-border' },
  { value: 'purple', label: 'Roxo', swatch: 'bg-nota-roxo', bg: 'bg-nota-roxo/[0.14]', border: 'border-nota-roxo/45' },
  { value: 'green', label: 'Verde', swatch: 'bg-nota-verde', bg: 'bg-nota-verde/[0.14]', border: 'border-nota-verde/45' },
  { value: 'orange', label: 'Laranja', swatch: 'bg-nota-laranja', bg: 'bg-nota-laranja/[0.14]', border: 'border-nota-laranja/45' },
  { value: 'red', label: 'Vermelho', swatch: 'bg-nota-vermelho', bg: 'bg-nota-vermelho/[0.14]', border: 'border-nota-vermelho/45' },
  { value: 'yellow', label: 'Amarelo', swatch: 'bg-nota-amarelo', bg: 'bg-nota-amarelo/[0.14]', border: 'border-nota-amarelo/45' },
];

export function corDaNota(cor: string | null | undefined): CorNota {
  return CORES_NOTA.find((c) => c.value === cor) ?? CORES_NOTA[0]!;
}
