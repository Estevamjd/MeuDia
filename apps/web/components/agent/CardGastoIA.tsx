'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { hojeSP } from '@meudia/shared';
import { useCarteiras, useGastei, usePainelSaldo } from '../../hooks';
import { Button, Input, Select } from '../ui';
import { formatBRL, formatDiaMes, mascaraBRL } from '../../lib/financas-ui';
import { CATEGORIAS_IA, type PropostaGasto } from '../../lib/ia/proposta';

interface CardGastoIAProps {
  proposta: PropostaGasto;
  /** Depois de gravar (texto curto para o chat). */
  onConfirmado: (resumo: string) => void;
  /** Cancelar: não grava nada. */
  onCancelado: () => void;
}

/**
 * Card do gasto que o assistente entendeu. Nada é gravado antes do Confirmar, que usa o mesmo
 * caminho do "Gastei" (`useGastei` → `carteirasService.gastei`). Editar ajusta os campos no próprio card.
 */
export function CardGastoIA({ proposta, onConfirmado, onCancelado }: CardGastoIAProps) {
  const hojeISO = useMemo(() => hojeSP(), []);
  const carteiras = useCarteiras();
  const painel = usePainelSaldo(hojeISO);
  const gastei = useGastei(hojeISO);

  const ativas = (carteiras.data ?? []).filter((c) => !c.arquivada);
  const padraoPainel = painel.data?.carteiraPadraoId;
  const padrao = ativas.find((c) => c.id === padraoPainel)?.id ?? ativas[0]?.id ?? null;

  const [editando, setEditando] = useState(false);
  const [digitos, setDigitos] = useState(String(Math.round(proposta.valor * 100)));
  const [categoria, setCategoria] = useState(proposta.categoria);
  const [descricao, setDescricao] = useState(proposta.descricao);
  const [data, setData] = useState(proposta.data);
  const [carteira, setCarteira] = useState<string | null>(proposta.carteira_id);
  const [erro, setErro] = useState<string | null>(null);

  const { valor, exibicao } = mascaraBRL(digitos);
  const carteiraId = ativas.some((c) => c.id === carteira) ? carteira : padrao;
  const carteiraNome = ativas.find((c) => c.id === carteiraId)?.nome ?? null;
  const semCarteira = !carteiras.isLoading && ativas.length === 0;

  const confirmar = () => {
    if (!(valor > 0)) return setErro('Informe um valor maior que zero.');
    if (!data || data > hojeISO) return setErro('A data não pode ser depois de hoje.');
    if (!carteiraId) return setErro('Escolha de onde saiu.');
    setErro(null);
    gastei.mutate(
      { valor, categoria, descricao: descricao.trim() || undefined, carteira_id: carteiraId, data },
      {
        onSuccess: () => onConfirmado(`Gasto salvo: ${formatBRL(valor)} em ${categoria}${carteiraNome ? ` (${carteiraNome})` : ''}.`),
        onError: () => setErro('Não foi possível salvar o gasto. Tente de novo.'),
      },
    );
  };

  return (
    <section aria-label="Gasto para confirmar" data-testid="card-gasto-ia" className="rounded-xl border border-accent/30 bg-card2 p-3 text-sm">
      <p className="mb-2 font-semibold text-text">Confere o gasto?</p>

      {editando ? (
        <div className="space-y-3">
          <Input
            id="ia-valor"
            label="Valor"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="R$ 0,00"
            value={exibicao}
            onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
          />
          <Select
            id="ia-categoria"
            label="Categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            options={CATEGORIAS_IA.map((c) => ({ value: c, label: c }))}
          />
          <Input id="ia-descricao" label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <Input id="ia-data" label="Quando" type="date" max={hojeISO} value={data} onChange={(e) => setData(e.target.value)} />
          {ativas.length > 0 && (
            <Select
              id="ia-carteira"
              label="Saiu de"
              value={carteiraId ?? ''}
              onChange={(e) => setCarteira(e.target.value)}
              options={ativas.map((c) => ({ value: c.id, label: c.nome }))}
            />
          )}
        </div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted">Valor</dt>
          <dd className="font-semibold text-text" data-testid="ia-valor">{formatBRL(valor)}</dd>
          <dt className="text-muted">Categoria</dt>
          <dd className="text-text" data-testid="ia-categoria">{categoria}</dd>
          <dt className="text-muted">Descrição</dt>
          <dd className="text-text">{descricao || categoria}</dd>
          <dt className="text-muted">Quando</dt>
          <dd className="text-text" data-testid="ia-data">{data === hojeISO ? 'Hoje' : formatDiaMes(data)}</dd>
          <dt className="text-muted">Saiu de</dt>
          <dd className="text-text">{carteiras.isLoading ? 'Carregando…' : (carteiraNome ?? '—')}</dd>
        </dl>
      )}

      {semCarteira && (
        <p className="mt-2 text-xs text-muted">
          Para salvar, cadastre onde fica seu dinheiro.{' '}
          <Link href="/financas/carteiras?nova=1" className="text-accent underline">
            Adicionar banco ou carteira
          </Link>
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-xs text-red">
          {erro}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={confirmar}
          isLoading={gastei.isPending}
          disabled={carteiras.isLoading || semCarteira || gastei.isPending}
          className="min-h-[44px] flex-1"
        >
          Confirmar
        </Button>
        {!editando && (
          <Button type="button" variant="ghost" onClick={() => setEditando(true)} disabled={gastei.isPending} className="min-h-[44px]">
            Editar
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancelado} disabled={gastei.isPending} className="min-h-[44px]">
          Cancelar
        </Button>
      </div>
    </section>
  );
}
