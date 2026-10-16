import Link from 'next/link';
import { Button } from '../../ui';

export interface BoasVindasFinancasProps {
  rendaCadastrada: boolean;
  onCadastrarRenda: () => void;
}

const TOTAL_PASSOS = 2;

const PASSOS = {
  1: { titulo: 'Vamos montar seu mês', subtitulo: 'Comece pela sua renda. Leva menos de um minuto.' },
  2: { titulo: 'Agora, suas contas', subtitulo: 'Adicione luz, aluguel e assinaturas para ver quanto sobra.' },
} as const;

const BOTAO_GRANDE = 'w-full py-3 text-base';

/** Onboarding da home: um passo por vez (renda → contas), com "Passo X de 2". */
export function BoasVindasFinancas({ rendaCadastrada, onCadastrarRenda }: BoasVindasFinancasProps) {
  const passo = rendaCadastrada ? 2 : 1;
  const { titulo, subtitulo } = PASSOS[passo];

  return (
    <section aria-labelledby="boas-vindas-financas" className="space-y-4 rounded-card border border-accent/30 bg-card p-5">
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-muted">
          Passo {passo} de {TOTAL_PASSOS}
        </p>
        <div className="flex gap-1.5" aria-hidden="true" data-testid="progresso-passos">
          {Array.from({ length: TOTAL_PASSOS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < passo ? 'bg-accent' : 'bg-card2'}`} />
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <h2 id="boas-vindas-financas" className="text-lg font-semibold text-text">
          {titulo}
        </h2>
        <p className="text-[15px] text-muted">{subtitulo}</p>
      </div>

      {passo === 1 ? (
        <Button className={BOTAO_GRANDE} onClick={onCadastrarRenda}>
          Cadastrar minha renda
        </Button>
      ) : (
        <Link
          href="/financas/contas?nova=1"
          className={`inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-accent to-accent2 font-medium text-white transition-all duration-200 hover:opacity-90 ${BOTAO_GRANDE}`}
        >
          Adicionar conta
        </Link>
      )}
    </section>
  );
}
