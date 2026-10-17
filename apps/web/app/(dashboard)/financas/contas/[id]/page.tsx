'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { competenciaDe, hojeSP } from '@meudia/shared';
import { useCarteiras, useContaDoMes, usePainelSaldo } from '../../../../../hooks';
import { Badge, Button, Input, SkeletonCard } from '../../../../../components/ui';
import { usePagamentoAcoes } from '../../../../../components/financas/usePagamentoAcoes';
import { SeletorCarteira } from '../../../../../components/financas/SeletorCarteira';
import { CategoriaIcone } from '../../../../../components/financas/CategoriaIcone';
import {
  SITUACAO_UI,
  formatBRL,
  formatDiaMes,
  isCompetencia,
  mensagemErroPagamento,
  rotuloCompetencia,
} from '../../../../../lib/financas-ui';
import { descreverVencimento } from '../../../../../lib/contas-form';

/** Destino do push: `/financas/contas/<id>?competencia=YYYY-MM` (default: mês atual em SP). */
export default function ContaDetalhePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <ContaDetalhe id={params.id} />
    </Suspense>
  );
}

function ContaDetalhe({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const hoje = hojeSP();
  const param = searchParams.get('competencia');
  const competencia = isCompetencia(param) ? param : competenciaDe(hoje);

  const { data, isLoading, isError, error } = useContaDoMes(id, competencia);
  const { pagarConta, desfazerPagamento, contaOcupada } = usePagamentoAcoes();
  const [pagoEm, setPagoEm] = useState(hoje);
  const [banco, setBanco] = useState('');
  // Com bancos cadastrados, o seletor substitui o texto livre; padrão = último usado (ou o primeiro).
  const carteiras = (useCarteiras().data ?? []).filter((c) => !c.arquivada);
  const padrao = usePainelSaldo(hoje).data?.carteiraPadraoId ?? carteiras[0]?.id ?? null;
  const [carteiraEscolhida, setCarteira] = useState<string | null>(null);
  const carteira = carteiraEscolhida ?? padrao;

  const voltar = (
    <Link href="/financas" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
      <ArrowLeft size={16} aria-hidden="true" /> Finanças
    </Link>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {voltar}
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        {voltar}
        <p role="alert" className="rounded-card border border-red/40 bg-card p-4 text-sm text-text">
          {mensagemErroPagamento(error)}
        </p>
      </div>
    );
  }

  const { conta, situacao, pagamento, vencimento, historico } = data;
  const ui = SITUACAO_UI[situacao];
  const alvo = { contaId: conta.id, competencia, descricao: conta.descricao };
  const ocupada = contaOcupada === conta.id;

  return (
    <div className="animate-fadeSlide mx-auto max-w-xl space-y-6">
      {voltar}

      <header className="space-y-1">
        <p className="text-sm text-muted">{rotuloCompetencia(competencia)}</p>
        <h1 className="flex flex-wrap items-center gap-2 font-syne text-3xl font-bold text-text">
          <CategoriaIcone categoria={conta.categoria} />
          {conta.descricao}
          <Badge color={ui.color}>{ui.label}</Badge>
        </h1>
        <p className="text-2xl font-bold text-text">{formatBRL(Number(conta.valor))}</p>
        <p className="text-sm text-muted">
          Vence {formatDiaMes(vencimento)} · {descreverVencimento(conta)} · {conta.categoria}
        </p>
      </header>

      <section aria-live="polite" className="space-y-4 rounded-card border border-border bg-card p-4">
        {pagamento ? (
          <>
            <p className="flex items-center gap-2 text-sm text-green">
              <CheckCircle2 size={18} aria-hidden="true" /> Paga em {formatDiaMes(pagamento.pago_em)}. Sem mais lembretes deste mês.
            </p>
            <Button variant="ghost" onClick={() => desfazerPagamento(alvo)} isLoading={ocupada}>
              Desfazer pagamento
            </Button>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              pagarConta(
                alvo,
                carteiras.length && carteira
                  ? { pago_em: pagoEm || undefined, carteira_id: carteira }
                  : { pago_em: pagoEm || undefined, banco: banco.trim() || null },
              );
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Data do pagamento" type="date" value={pagoEm} max={hoje} onChange={(e) => setPagoEm(e.target.value)} />
              {carteiras.length === 0 && (
                <Input label="Banco (opcional)" placeholder="Ex: Nubank" value={banco} onChange={(e) => setBanco(e.target.value)} />
              )}
            </div>
            {carteiras.length > 0 && (
              <SeletorCarteira id="paguei-carteira" label="Pagou com" carteiras={carteiras} value={carteira} onChange={setCarteira} />
            )}
            <Button type="submit" isLoading={ocupada} className="w-full py-4 text-lg">
              Paguei
            </Button>
          </form>
        )}
      </section>

      <section aria-labelledby="historico" className="space-y-2">
        <h2 id="historico" className="font-syne text-lg font-semibold text-text">
          Histórico de pagamentos
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pagamento registrado ainda.</p>
        ) : (
          <ul className="space-y-1">
            {[...historico]
              .sort((a, b) => b.competencia.localeCompare(a.competencia))
              .map((p) => (
                <li key={p.id} className="flex justify-between rounded-lg bg-card2 px-3 py-2 text-sm">
                  <Link href={`/financas/contas/${conta.id}?competencia=${p.competencia}`} className="text-text hover:underline">
                    {rotuloCompetencia(p.competencia)}
                  </Link>
                  <span className="text-muted">pago em {formatDiaMes(p.pago_em)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
