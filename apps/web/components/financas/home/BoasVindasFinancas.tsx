import Link from 'next/link';
import { clsx } from 'clsx';

export interface BoasVindasFinancasProps {
  rendaCadastrada: boolean;
  onCadastrarRenda: () => void;
}

const TOTAL_PASSOS = 2;

const PASSOS = {
  1: { titulo: 'Vamos montar seu mês', acao: 'Cadastrar minha renda' },
  2: { titulo: 'Agora, suas contas', acao: 'Adicionar conta' },
} as const;

/** Botão de 36px com área de toque de 44px pelo ::before. */
const CLASSE_ACAO =
  "relative inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg transition-colors hover:bg-accent3 before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Onboarding da home numa faixa só (≤ 56px), para o "Gastei" caber acima da dobra no iPhone 13: um passo por vez
 * (renda → contas), "Passo X de 2" e a barra preenchendo só o que já foi feito.
 */
export function BoasVindasFinancas({ rendaCadastrada, onCadastrarRenda }: BoasVindasFinancasProps) {
  const passo = rendaCadastrada ? 2 : 1;
  const concluidos = passo - 1;
  const { titulo, acao } = PASSOS[passo];

  return (
    <section
      aria-labelledby="boas-vindas-financas"
      data-testid="boas-vindas"
      className="lap-cartao flex min-h-[52px] items-center justify-between gap-3 !border-accent/30 px-3.5 py-2"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-medium leading-none text-muted">
            Passo {passo} de {TOTAL_PASSOS}
          </span>
          <span className="flex w-14 gap-1" aria-hidden="true" data-testid="progresso-passos">
            {Array.from({ length: TOTAL_PASSOS }, (_, i) => (
              <span
                key={i}
                data-estado={i < concluidos ? 'feito' : 'falta'}
                className={clsx('h-1 flex-1 rounded-full', i < concluidos ? 'bg-accent' : 'bg-trilho')}
              />
            ))}
          </span>
        </div>
        <h2 id="boas-vindas-financas" className="truncate text-[13.5px] font-medium leading-tight text-text">
          {titulo}
        </h2>
      </div>

      {passo === 1 ? (
        <button type="button" onClick={onCadastrarRenda} className={CLASSE_ACAO}>
          {acao}
        </button>
      ) : (
        <Link href="/financas/contas?nova=1" className={CLASSE_ACAO}>
          {acao}
        </Link>
      )}
    </section>
  );
}
