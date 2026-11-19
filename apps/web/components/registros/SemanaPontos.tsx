import { clsx } from 'clsx';

const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const NOMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

/** Seg..Dom da semana: ponto ciano = teve registro; hoje com anel. Lista acessível ("segunda: treinou"). */
export function SemanaPontos({ dias, hoje, rotuloFeito }: { dias: boolean[]; hoje: number; rotuloFeito: string }) {
  return (
    <ol aria-label="Esta semana" className="grid grid-cols-7 gap-1.5">
      {dias.map((feito, i) => (
        <li key={i} className="flex flex-col items-center gap-1.5" aria-label={`${NOMES[i]}: ${feito ? rotuloFeito : i > hoje ? 'ainda não chegou' : 'sem registro'}`}>
          <span aria-hidden="true" className={clsx('text-[11px] font-medium', i === hoje ? 'text-text' : 'text-muted')}>
            {LETRAS[i]}
          </span>
          <span
            aria-hidden="true"
            className={clsx(
              'h-3 w-3 rounded-full transition-colors',
              feito ? 'bg-accent shadow-[0_0_10px_rgba(0,229,255,0.65)]' : i > hoje ? 'bg-trilho/60' : 'bg-trilho',
              i === hoje && 'ring-2 ring-accent/40 ring-offset-2 ring-offset-card',
            )}
          />
        </li>
      ))}
    </ol>
  );
}
