import { Sparkles } from 'lucide-react';

/** Topo das telas de login e cadastro no visual Astro G do CRM: selo ciano com brilho, título e frase curta. */
export function MarcaAuth({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent/25 bg-accent/[0.1] text-accent shadow-[0_0_32px_-6px_rgba(0,229,255,0.6)]">
        <Sparkles size={22} aria-hidden="true" />
      </span>
      <p className="lap-rotulo mt-4 text-accent">MeuDia</p>
      <h1 className="mt-2 text-[26px] font-light leading-8 tracking-[-0.03em] text-text">{titulo}</h1>
      <p className="mt-1.5 text-sm text-muted">{subtitulo}</p>
    </div>
  );
}
