'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { Archive, ArchiveRestore, ArrowLeftRight, Landmark, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import type { Carteira, TipoCarteira, Transferencia } from '@meudia/shared';
import { hojeSP } from '@meudia/shared';
import { useAtualizarCarteira, useCorrigirSaldo, useCriarCarteira, useExcluirCarteira, useExcluirTransferencia, usePainelSaldo } from '../../../../hooks';
import { Button, ConfirmDialog, EmptyState, Input, Modal, Select, SkeletonList, useToast } from '../../../../components/ui';
import { IconeCarteira } from '../../../../components/financas/SeletorCarteira';
import { ConfirmarExclusao } from '../../../../components/financas/ConfirmarExclusao';
import { TIPO_CARTEIRA_LABEL, comSinal, detalheExclusaoCarteira, detalheExclusaoTransferencia, rotuloTransferencia } from '../../../../lib/carteiras-ui';
import { formatBRL, formatBRLSinal, formatDiaMes, mascaraBRL } from '../../../../lib/financas-ui';

export default function CarteirasPage() {
  return (
    <Suspense fallback={<SkeletonList count={3} />}>
      <CarteirasConteudo />
    </Suspense>
  );
}

const TIPOS = (Object.keys(TIPO_CARTEIRA_LABEL) as TipoCarteira[]).map((t) => ({ value: t, label: TIPO_CARTEIRA_LABEL[t] }));

function CarteirasConteudo() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hojeISO = useMemo(() => hojeSP(), []);
  const painel = usePainelSaldo(hojeISO);
  const atualizar = useAtualizarCarteira();
  const excluirCarteira = useExcluirCarteira();
  const excluirTransferencia = useExcluirTransferencia();

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Carteira | null>(null);
  const [arquivando, setArquivando] = useState<Carteira | null>(null);
  const [excluindo, setExcluindo] = useState<Carteira | null>(null);
  const [excluindoTransferencia, setExcluindoTransferencia] = useState<Transferencia | null>(null);
  const [corrigindo, setCorrigindo] = useState<{ carteira: Carteira; saldo: number } | null>(null);

  // `?nova=1` (atalhos da home e da folha do "+") abre o cadastro; o param sai da URL.
  const pedeNova = searchParams.get('nova') === '1';
  useEffect(() => {
    if (!pedeNova) return;
    setCriando(true);
    router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedeNova]);

  const confirmarArquivar = () => {
    if (!arquivando) return;
    atualizar.mutate(
      { id: arquivando.id, data: { arquivada: true } },
      {
        onSuccess: () => {
          toast.success(`"${arquivando.nome}" arquivada. O histórico continua.`);
          setArquivando(null);
        },
        onError: () => toast.error('Não foi possível arquivar.'),
      },
    );
  };

  const ativas = painel.data?.carteiras ?? [];
  const arquivadas = painel.data?.arquivadas ?? [];
  const nomes = new Map([...ativas.map((s) => s.carteira), ...arquivadas].map((c) => [c.id, c.nome]));
  const transferencias = [...(painel.data?.transferencias ?? [])].sort(
    (a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  );

  const confirmarExcluir = () => {
    if (!excluindo) return;
    excluirCarteira.mutate(excluindo.id, {
      onSuccess: () => {
        toast.success(`"${excluindo.nome}" excluída.`);
        setExcluindo(null);
      },
      onError: (e) => toast.error((e as { userMessage?: string }).userMessage ?? 'Não foi possível excluir. Tente de novo.'),
    });
  };

  const confirmarExcluirTransferencia = () => {
    if (!excluindoTransferencia) return;
    excluirTransferencia.mutate(excluindoTransferencia.id, {
      onSuccess: () => {
        toast.success('Transferência excluída');
        setExcluindoTransferencia(null);
      },
      onError: () => toast.error('Não foi possível excluir. Tente de novo.'),
    });
  };

  return (
    <div className="animate-fadeSlide space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-syne text-3xl font-bold text-text">Bancos e carteira</h1>
        <Button onClick={() => setCriando(true)} className="min-h-[44px] whitespace-nowrap" aria-label="Adicionar banco ou carteira">
          <Plus size={16} aria-hidden="true" /> Adicionar
        </Button>
      </div>

      {painel.isLoading ? (
        <SkeletonList count={3} />
      ) : painel.isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-red/40 bg-card p-3 text-sm">
          <span>Não foi possível carregar seus bancos.</span>
          <Button variant="ghost" onClick={() => void painel.refetch()}>Tentar de novo</Button>
        </div>
      ) : ativas.length === 0 && arquivadas.length === 0 ? (
        <EmptyState
          icon={<Landmark size={48} />}
          title="Onde fica seu dinheiro?"
          description="Cadastre seus bancos, a carteira (dinheiro vivo) e a poupança com quanto tem hoje."
          actionLabel="Adicionar banco ou carteira"
          onAction={() => setCriando(true)}
        />
      ) : (
        <>
          <p className="text-[15px] text-muted">
            Cofrinho: <span className="font-semibold tabular-nums text-text">{formatBRLSinal(painel.data!.saldoHoje)}</span>
            {ativas.some((s) => !s.carteira.incluir_no_total) ? ' (sem contar o que está fora do total)' : ''}.
          </p>
          <ul className="space-y-2">
            {ativas.map(({ carteira, saldo }) => (
              <li key={carteira.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <IconeCarteira tipo={carteira.tipo} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-text">{carteira.nome}</p>
                  <p className="text-[13px] text-muted">
                    {TIPO_CARTEIRA_LABEL[carteira.tipo]}
                    {carteira.incluir_no_total ? '' : ' · fora do total'}
                  </p>
                </div>
                <span className={clsx('shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums', saldo < 0 ? 'text-red' : 'text-text')}>
                  {formatBRLSinal(saldo)}
                </span>
                <div className="flex w-full justify-end gap-1 sm:w-auto">
                  <Button variant="ghost" className="min-h-[44px]" onClick={() => setCorrigindo({ carteira, saldo })} aria-label={`Corrigir saldo de ${carteira.nome}`}>
                    <Scale size={16} aria-hidden="true" /> Corrigir saldo
                  </Button>
                  <Button variant="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setEditando(carteira)} aria-label={`Editar ${carteira.nome}`}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setArquivando(carteira)} aria-label={`Arquivar ${carteira.nome}`}>
                    <Archive size={16} />
                  </Button>
                  <Button variant="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setExcluindo(carteira)} aria-label={`Excluir ${carteira.nome}`}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {arquivadas.length > 0 && (
            <section aria-labelledby="arquivadas" className="space-y-2">
              <h2 id="arquivadas" className="text-[15px] font-semibold text-muted">Arquivadas</h2>
              <ul className="space-y-2">
                {arquivadas.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-card border border-border bg-card/60 p-3">
                    <IconeCarteira tipo={c.tipo} />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">{c.nome}</span>
                    <Button
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={() => atualizar.mutate({ id: c.id, data: { arquivada: false } }, { onSuccess: () => toast.success(`"${c.nome}" voltou para a lista.`) })}
                    >
                      <ArchiveRestore size={16} aria-hidden="true" /> Desarquivar
                    </Button>
                    <Button variant="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setExcluindo(c)} aria-label={`Excluir ${c.nome}`}>
                      <Trash2 size={16} />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {transferencias.length > 0 && (
        <section aria-labelledby="transferencias" className="space-y-2">
          <h2 id="transferencias" className="text-[15px] font-semibold text-text">Transferências</h2>
          <ul className="space-y-2">
            {transferencias.map((tr) => (
              <li key={tr.id} className="flex items-center gap-3 rounded-card border border-border bg-card p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card2 text-muted">
                  <ArrowLeftRight size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-text">{rotuloTransferencia(tr, nomes)}</p>
                  <p className="text-[13px] text-muted">{formatDiaMes(tr.data)}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums text-text">{formatBRL(Number(tr.valor))}</span>
                <Button
                  variant="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => setExcluindoTransferencia(tr)}
                  aria-label={`Excluir transferência ${rotuloTransferencia(tr, nomes)} de ${formatBRL(Number(tr.valor))}`}
                >
                  <Trash2 size={16} />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal isOpen={criando} onClose={() => setCriando(false)} title="Novo banco ou carteira">
        {criando && <FormNova ordem={ativas.length + arquivadas.length} onFeito={() => setCriando(false)} />}
      </Modal>
      <Modal isOpen={!!editando} onClose={() => setEditando(null)} title="Editar banco ou carteira">
        {editando && <FormEditar carteira={editando} onFeito={() => setEditando(null)} />}
      </Modal>
      <Modal isOpen={!!corrigindo} onClose={() => setCorrigindo(null)} title="Corrigir saldo">
        {corrigindo && <FormCorrigir {...corrigindo} hojeISO={hojeISO} onFeito={() => setCorrigindo(null)} />}
      </Modal>
      <ConfirmDialog
        isOpen={!!arquivando}
        onClose={() => setArquivando(null)}
        onConfirm={confirmarArquivar}
        title="Arquivar"
        message={`Arquivar "${arquivando?.nome}"? Ela sai do total e dos seletores; os lançamentos antigos continuam no histórico.`}
        confirmLabel="Arquivar"
        isLoading={atualizar.isPending}
      />
      <ConfirmarExclusao
        isOpen={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={confirmarExcluir}
        titulo="Excluir banco"
        detalhe={excluindo ? detalheExclusaoCarteira(excluindo.nome, ativas.length + arquivadas.length === 1) : undefined}
        isLoading={excluirCarteira.isPending}
      />
      <ConfirmarExclusao
        isOpen={!!excluindoTransferencia}
        onClose={() => setExcluindoTransferencia(null)}
        onConfirm={confirmarExcluirTransferencia}
        titulo="Excluir transferência"
        detalhe={excluindoTransferencia ? detalheExclusaoTransferencia(excluindoTransferencia) : undefined}
        isLoading={excluirTransferencia.isPending}
      />
    </div>
  );
}

function CampoSomarNoTotal({ value, onChange, id }: { value: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card2 px-3">
      <span className="text-sm text-text">Somar no total</span>
      <input id={id} type="checkbox" role="switch" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#7c6aff]" />
    </label>
  );
}

function FormNova({ ordem, onFeito }: { ordem: number; onFeito: () => void }) {
  const toast = useToast();
  const criar = useCriarCarteira();
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoCarteira>('banco');
  const [digitos, setDigitos] = useState('');
  const [negativo, setNegativo] = useState(false);
  const [noTotal, setNoTotal] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro('Informe o nome (ex.: Nubank, Carteira).');
    setErro(null);
    criar.mutate(
      { nome: nome.trim(), tipo, saldo_inicial: comSinal(mascaraBRL(digitos).valor, negativo), incluir_no_total: noTotal, ordem },
      {
        onSuccess: () => {
          toast.success(`"${nome.trim()}" adicionada`);
          onFeito();
        },
        onError: () => toast.error('Não foi possível salvar. Tente de novo.'),
      },
    );
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Input id="carteira-nome" label="Nome" placeholder="Ex.: Nubank, Caixa, Carteira" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} required />
      <Select id="carteira-tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCarteira)} options={TIPOS} />
      <Input
        id="carteira-saldo"
        label="Quanto tem hoje"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={mascaraBRL(digitos).exibicao}
        onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
      />
      <label className="flex min-h-[44px] items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={negativo} onChange={(e) => setNegativo(e.target.checked)} className="h-5 w-5 accent-[#f87171]" />
        Está negativo (cheque especial)
      </label>
      <CampoSomarNoTotal id="carteira-total" value={noTotal} onChange={setNoTotal} />
      {erro && <p role="alert" className="text-sm text-red">{erro}</p>}
      <Button type="submit" isLoading={criar.isPending} className="w-full py-3 text-base">
        Salvar
      </Button>
    </form>
  );
}

function FormEditar({ carteira, onFeito }: { carteira: Carteira; onFeito: () => void }) {
  const toast = useToast();
  const atualizar = useAtualizarCarteira();
  const [nome, setNome] = useState(carteira.nome);
  const [tipo, setTipo] = useState<TipoCarteira>(carteira.tipo);
  const [noTotal, setNoTotal] = useState(carteira.incluir_no_total);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    atualizar.mutate(
      { id: carteira.id, data: { nome: nome.trim(), tipo, incluir_no_total: noTotal } },
      {
        onSuccess: () => {
          toast.success('Salvo');
          onFeito();
        },
        onError: () => toast.error('Não foi possível salvar.'),
      },
    );
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Input id="editar-carteira-nome" label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} required />
      <Select id="editar-carteira-tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCarteira)} options={TIPOS} />
      <CampoSomarNoTotal id="editar-carteira-total" value={noTotal} onChange={setNoTotal} />
      <p className="text-[13px] text-muted">Para mudar o saldo, use &quot;Corrigir saldo&quot;: fica registrado como ajuste.</p>
      <Button type="submit" isLoading={atualizar.isPending} className="w-full py-3 text-base">
        Salvar
      </Button>
    </form>
  );
}

function FormCorrigir({ carteira, saldo, hojeISO, onFeito }: { carteira: Carteira; saldo: number; hojeISO: string; onFeito: () => void }) {
  const toast = useToast();
  const corrigir = useCorrigirSaldo(hojeISO);
  const [digitos, setDigitos] = useState('');
  const [negativo, setNegativo] = useState(false);
  const real = comSinal(mascaraBRL(digitos).valor, negativo);
  const diferenca = Math.round((real - saldo) * 100) / 100;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    corrigir.mutate(
      { carteira_id: carteira.id, saldo_real: real },
      {
        onSuccess: (t) => {
          toast.success(t ? 'Saldo corrigido' : 'O saldo já estava certo');
          onFeito();
        },
        onError: () => toast.error('Não foi possível corrigir. Tente de novo.'),
      },
    );
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <p className="text-[15px] text-muted">
        No MeuDia, {carteira.nome} tem <span className="font-semibold tabular-nums text-text">{formatBRLSinal(saldo)}</span>.
      </p>
      <Input
        id="corrigir-saldo"
        label="Quanto o banco mostra agora?"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={mascaraBRL(digitos).exibicao}
        onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
      />
      <label className="flex min-h-[44px] items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={negativo} onChange={(e) => setNegativo(e.target.checked)} className="h-5 w-5 accent-[#f87171]" />
        Está negativo
      </label>
      {digitos && diferenca !== 0 && (
        <p className="text-[13px] text-muted">
          Vamos lançar um ajuste de {formatBRLSinal(diferenca)}. Ele muda o saldo, mas não conta como gasto nem renda do mês.
        </p>
      )}
      <Button type="submit" isLoading={corrigir.isPending} disabled={!digitos && !negativo} className="w-full py-3 text-base">
        Corrigir
      </Button>
    </form>
  );
}
