'use client';

import type { EstadoPerfilSaude } from '../../lib/perfil-saude';
import { LinkAcao } from '../caderno';

/**
 * Por que o perfil de saúde está só leitura: carregando (fonte ainda null) ou sem conexão ('indisponivel', com
 * "Tentar de novo"). Nada aparece com estado conhecido.
 */
export function AvisoPerfilSoLeitura({
  fonte,
  onTentarDeNovo,
  className,
}: {
  fonte: EstadoPerfilSaude['fonte'] | null;
  onTentarDeNovo: () => void;
  className?: string;
}) {
  if (fonte === null) {
    return (
      <p role="status" className={className ?? 'mt-5 text-[13px] text-muted-text'}>
        Carregando seu perfil de saúde…
      </p>
    );
  }
  if (fonte !== 'indisponivel') return null;
  return (
    <div role="status" className={className ?? 'mt-5 border-l-2 border-accent3 pl-3'}>
      <p className="text-[13px] text-text">Sem conexão com a sua conta agora. Dá para salvar quando a conexão voltar.</p>
      <LinkAcao onClick={onTentarDeNovo}>tentar de novo</LinkAcao>
    </div>
  );
}
