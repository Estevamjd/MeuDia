'use client';

import { useEffect, useRef, useState } from 'react';
import { preferirMenosMovimento } from '../../lib/feedback';

interface NumeroAnimadoProps {
  valor: number;
  formatar: (n: number) => string;
  /** Duração da contagem em ms (curta: é um detalhe, não um show). */
  duracao?: number;
}

/**
 * Número que conta até o valor quando ele muda (ease-out, ~0,5 s). Sem animação com "reduzir movimento"
 * ou fora do navegador. Leitores de tela recebem só o valor final (aria-label), nunca os intermediários.
 */
export function NumeroAnimado({ valor, formatar, duracao = 500 }: NumeroAnimadoProps) {
  const [mostrado, setMostrado] = useState(valor);
  const anterior = useRef(valor);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = valor;
    if (de === valor || preferirMenosMovimento() || typeof requestAnimationFrame !== 'function') {
      setMostrado(valor);
      return;
    }
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const ease = 1 - (1 - t) ** 3;
      setMostrado(t >= 1 ? valor : de + (valor - de) * ease);
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracao]);

  const final = formatar(valor);
  return (
    <span aria-label={final}>
      <span aria-hidden="true">{formatar(mostrado)}</span>
    </span>
  );
}
