'use client';

import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Scale } from 'lucide-react';
import { Button, Input, Modal, useToast } from '../../ui';
import { useCorrigirCofrinho, useMoverCofrinho } from '../../../hooks';
import { formatBRL, formatBRLSinal, mascaraBRL } from '../../../lib/financas-ui';

type Acao = 'guardar' | 'tirar' | 'corrigir';

const TITULO: Record<Acao, string> = { guardar: 'Guardar no Cofrinho', tirar: 'Tirar do Cofrinho', corrigir: 'Corrigir o Cofrinho' };

const mensagemErro = (e: unknown) => (e as { userMessage?: string })?.userMessage ?? 'Não foi possível salvar. Tente de novo.';

/** Bancos: o Cofrinho (dinheiro guardado) com as três ações que mudam ele. Gasto não mexe aqui. */
export function CardCofrinho({ saldo }: { saldo: number }) {
  const [acao, setAcao] = useState<Acao | null>(null);
  return (
    <section aria-labelledby="cofrinho-titulo" className="rounded-card border border-accent/30 bg-card p-4" data-testid="card-cofrinho">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <PiggyBank size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="cofrinho-titulo" className="text-[15px] font-medium text-text">Cofrinho</h2>
          <p className="text-[13px] text-muted">Dinheiro guardado. Gastos não mexem aqui.</p>
        </div>
        <span data-testid="cofrinho-valor" className="shrink-0 whitespace-nowrap text-xl font-semibold tabular-nums text-text">
          {formatBRLSinal(saldo)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={() => setAcao('guardar')}>
          <ArrowDownToLine size={16} aria-hidden="true" /> Guardar
        </Button>
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={() => setAcao('tirar')} disabled={saldo <= 0}>
          <ArrowUpFromLine size={16} aria-hidden="true" /> Tirar
        </Button>
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={() => setAcao('corrigir')} aria-label="Corrigir o valor do Cofrinho">
          <Scale size={16} aria-hidden="true" /> Corrigir
        </Button>
      </div>
      <Modal isOpen={!!acao} onClose={() => setAcao(null)} title={acao ? TITULO[acao] : ''}>
        {acao === 'corrigir' && <FormCorrigirCofrinho saldo={saldo} onFeito={() => setAcao(null)} />}
        {(acao === 'guardar' || acao === 'tirar') && <FormMover tipo={acao} saldo={saldo} onFeito={() => setAcao(null)} />}
      </Modal>
    </section>
  );
}

function FormMover({ tipo, saldo, onFeito }: { tipo: 'guardar' | 'tirar'; saldo: number; onFeito: () => void }) {
  const toast = useToast();
  const mover = useMoverCofrinho();
  const [digitos, setDigitos] = useState('');
  const { valor, exibicao } = mascaraBRL(digitos);
  const passou = tipo === 'tirar' && valor > saldo;
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!(valor > 0) || passou) return;
        mover.mutate(
          { tipo, valor },
          {
            onSuccess: () => {
              toast.success(tipo === 'guardar' ? `Guardado: ${formatBRL(valor)}` : `Tirado: ${formatBRL(valor)}`);
              onFeito();
            },
            onError: (e) => toast.error(mensagemErro(e)),
          },
        );
      }}
    >
      <p className="text-[15px] text-muted">
        No Cofrinho agora: <span className="font-semibold tabular-nums text-text">{formatBRLSinal(saldo)}</span>.
      </p>
      <Input
        id="cofrinho-mover-valor"
        label={tipo === 'guardar' ? 'Quanto guardar?' : 'Quanto tirar?'}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={exibicao}
        onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
        error={passou ? 'Esse valor é maior do que tem no Cofrinho.' : undefined}
      />
      <p className="text-[13px] text-muted">
        {tipo === 'guardar'
          ? 'Só muda o Cofrinho. Não conta como gasto nem mexe na sobra do mês.'
          : 'Só muda o Cofrinho. Se for gastar esse dinheiro, lance o gasto também.'}
      </p>
      <Button type="submit" isLoading={mover.isPending} disabled={!(valor > 0) || passou} className="w-full py-3 text-base">
        {tipo === 'guardar' ? 'Guardar' : 'Tirar'}
      </Button>
    </form>
  );
}

function FormCorrigirCofrinho({ saldo, onFeito }: { saldo: number; onFeito: () => void }) {
  const toast = useToast();
  const corrigir = useCorrigirCofrinho();
  const [digitos, setDigitos] = useState('');
  const { valor, exibicao } = mascaraBRL(digitos);
  const diferenca = Math.round((valor - saldo) * 100) / 100;
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!digitos) return;
        corrigir.mutate(
          { valor_real: valor },
          {
            onSuccess: (m) => {
              toast.success(m ? 'Cofrinho corrigido' : 'O Cofrinho já estava certo');
              onFeito();
            },
            onError: (e) => toast.error(mensagemErro(e)),
          },
        );
      }}
    >
      <p className="text-[15px] text-muted">
        No MeuDia, o Cofrinho tem <span className="font-semibold tabular-nums text-text">{formatBRLSinal(saldo)}</span>.
      </p>
      <Input
        id="corrigir-cofrinho"
        label="Quanto você tem guardado de verdade?"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={exibicao}
        onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
      />
      {digitos && diferenca !== 0 && (
        <p className="text-[13px] text-muted">O Cofrinho passa a ter {formatBRL(valor)} ({formatBRLSinal(diferenca)}). Nada muda nos bancos nem na sobra do mês.</p>
      )}
      <Button type="submit" isLoading={corrigir.isPending} disabled={!digitos} className="w-full py-3 text-base">
        Corrigir
      </Button>
    </form>
  );
}
