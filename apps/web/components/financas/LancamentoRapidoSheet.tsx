'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, HandCoins, ShoppingBag } from 'lucide-react';
import { CATEGORIA_OUTROS, hojeSP } from '@meudia/shared';
import { useCarteiras, useEntrouDinheiro, useGastei, usePainelSaldo, useTransferir } from '../../hooks';
import { Button, Input, Modal, useToast } from '../ui';
import { mascaraBRL } from '../../lib/financas-ui';
import { SeletorCategoria } from './SeletorCategoria';
import { SeletorCarteira } from './SeletorCarteira';

export type AcaoRapida = 'menu' | 'gastei' | 'entrou' | 'transferir';

const TITULOS: Record<AcaoRapida, string> = {
  menu: 'O que aconteceu?',
  gastei: 'Gastei',
  entrou: 'Entrou dinheiro',
  transferir: 'Transferir',
};

interface LancamentoRapidoSheetProps {
  open: boolean;
  onClose: () => void;
  inicial?: AcaoRapida;
}

/** Folha do "+": Gastei · Entrou dinheiro · Transferir (o "Paguei" e o "Recebi" ficam nos cards da home). */
export function LancamentoRapidoSheet({ open, onClose, inicial = 'menu' }: LancamentoRapidoSheetProps) {
  const [acao, setAcao] = useState<AcaoRapida>(inicial);
  useEffect(() => {
    if (open) setAcao(inicial);
  }, [open, inicial]);

  return (
    <Modal isOpen={open} onClose={onClose} title={TITULOS[acao]} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      {open && <Conteudo acao={acao} setAcao={setAcao} onClose={onClose} />}
    </Modal>
  );
}

function Conteudo({ acao, setAcao, onClose }: { acao: AcaoRapida; setAcao: (a: AcaoRapida) => void; onClose: () => void }) {
  // Data de hoje em SP no momento em que a folha abre (igual ao backend).
  const hojeISO = useMemo(() => hojeSP(), []);
  const carteiras = useCarteiras();
  const painel = usePainelSaldo(hojeISO);
  const ativas = (carteiras.data ?? []).filter((c) => !c.arquivada);
  const padrao = painel.data?.carteiraPadraoId ?? ativas[0]?.id ?? null;

  if (acao === 'menu') {
    const opcoes = [
      { acao: 'gastei' as const, rotulo: 'Gastei', dica: 'Saiu dinheiro (mercado, lanche, Uber...)', Icone: ShoppingBag, cor: 'text-red bg-red/[0.14]' },
      { acao: 'entrou' as const, rotulo: 'Entrou dinheiro', dica: 'Freela, Pix, um extra que caiu', Icone: HandCoins, cor: 'text-green bg-green/[0.14]' },
      { acao: 'transferir' as const, rotulo: 'Transferir', dica: 'De um banco para outro (não é gasto)', Icone: ArrowLeftRight, cor: 'text-accent bg-accent/[0.14]' },
    ];
    return (
      <div className="flex flex-col gap-3">
        {opcoes.map(({ acao: a, rotulo, dica, Icone, cor }) => (
          <button
            key={a}
            type="button"
            onClick={() => setAcao(a)}
            className="flex min-h-[64px] items-center gap-4 rounded-xl border border-border bg-card2 p-4 text-left transition-colors hover:border-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cor}`} aria-hidden="true">
              <Icone size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-text">{rotulo}</span>
              <span className="block text-[13px] text-muted">{dica}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (carteiras.isLoading) return <p className="text-sm text-muted">Carregando seus bancos…</p>;

  if (ativas.length === 0 || (acao === 'transferir' && ativas.length < 2)) {
    return (
      <div className="space-y-4">
        <p className="text-[15px] text-muted">
          {ativas.length === 0
            ? 'Primeiro diga onde fica seu dinheiro (banco, carteira ou poupança).'
            : 'Para transferir, cadastre pelo menos dois bancos ou carteiras.'}
        </p>
        <Link
          href="/financas/carteiras?nova=1"
          onClick={onClose}
          className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-accent to-accent2 py-3 text-base font-medium text-white"
        >
          Adicionar banco ou carteira
        </Link>
      </div>
    );
  }

  const props = { hojeISO, carteiras: ativas, padrao, onFeito: onClose, onVoltar: () => setAcao('menu') };
  if (acao === 'gastei') return <FormGastei {...props} />;
  if (acao === 'entrou') return <FormEntrou {...props} />;
  return <FormTransferir {...props} />;
}

interface FormProps {
  hojeISO: string;
  carteiras: { id: string; nome: string; tipo: 'banco' | 'dinheiro' | 'poupanca' }[];
  padrao: string | null;
  onFeito: () => void;
  onVoltar: () => void;
}

function CampoValor({ id, digitos, setDigitos, erro }: { id: string; digitos: string; setDigitos: (d: string) => void; erro?: string }) {
  const { exibicao } = mascaraBRL(digitos);
  return (
    <Input
      id={id}
      label="Valor"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="R$ 0,00"
      value={exibicao}
      onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
      error={erro}
      aria-invalid={!!erro}
      className="text-lg"
      required
    />
  );
}

function CampoData({ id, value, onChange, hojeISO }: { id: string; value: string; onChange: (v: string) => void; hojeISO: string }) {
  return <Input id={id} label="Quando" type="date" max={hojeISO} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Rodape({ onVoltar, salvando, rotulo }: { onVoltar: () => void; salvando: boolean; rotulo: string }) {
  return (
    <div className="flex gap-3 pt-1">
      <Button type="button" variant="ghost" onClick={onVoltar} className="min-h-[44px]">
        Voltar
      </Button>
      <Button type="submit" isLoading={salvando} className="min-h-[44px] flex-1 py-3 text-base">
        {rotulo}
      </Button>
    </div>
  );
}

function validar(valor: number, data: string, hojeISO: string): { valor?: string; data?: string } {
  const erros: { valor?: string; data?: string } = {};
  if (valor <= 0) erros.valor = 'Informe um valor maior que zero.';
  if (!data || data > hojeISO) erros.data = 'A data não pode ser depois de hoje.';
  return erros;
}

function FormGastei({ hojeISO, carteiras, padrao, onFeito, onVoltar }: FormProps) {
  const toast = useToast();
  const gastei = useGastei(hojeISO);
  const [digitos, setDigitos] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIA_OUTROS);
  const [carteira, setCarteira] = useState<string | null>(padrao);
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(hojeISO);
  const [erros, setErros] = useState<{ valor?: string; data?: string; carteira?: string }>({});

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const { valor } = mascaraBRL(digitos);
    const novos = { ...validar(valor, data, hojeISO), ...(carteira ? {} : { carteira: 'Escolha de onde saiu.' }) };
    setErros(novos);
    if (Object.keys(novos).length || !carteira) return;
    gastei.mutate(
      { valor, categoria, descricao: descricao.trim() || undefined, carteira_id: carteira, data },
      {
        onSuccess: () => {
          toast.success('Gasto salvo');
          onFeito();
        },
        onError: () => toast.error('Não foi possível salvar o gasto. Tente de novo.'),
      },
    );
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <CampoValor id="gastei-valor" digitos={digitos} setDigitos={setDigitos} erro={erros.valor} />
      <SeletorCategoria id="gastei-categoria" value={categoria} onChange={setCategoria} />
      <SeletorCarteira id="gastei-carteira" label="Saiu de" carteiras={carteiras} value={carteira} onChange={setCarteira} />
      {erros.carteira && <p role="alert" className="text-xs text-red">{erros.carteira}</p>}
      <Input id="gastei-descricao" label="Descrição (opcional)" placeholder={categoria} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <CampoData id="gastei-data" value={data} onChange={setData} hojeISO={hojeISO} />
      {erros.data && <p role="alert" className="text-xs text-red">{erros.data}</p>}
      <Rodape onVoltar={onVoltar} salvando={gastei.isPending} rotulo="Salvar gasto" />
    </form>
  );
}

function FormEntrou({ hojeISO, carteiras, padrao, onFeito, onVoltar }: FormProps) {
  const toast = useToast();
  const entrou = useEntrouDinheiro(hojeISO);
  const [digitos, setDigitos] = useState('');
  const [carteira, setCarteira] = useState<string | null>(padrao);
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(hojeISO);
  const [erros, setErros] = useState<{ valor?: string; data?: string; carteira?: string }>({});

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const { valor } = mascaraBRL(digitos);
    const novos = { ...validar(valor, data, hojeISO), ...(carteira ? {} : { carteira: 'Escolha onde entrou.' }) };
    setErros(novos);
    if (Object.keys(novos).length || !carteira) return;
    entrou.mutate(
      { valor, descricao: descricao.trim() || undefined, carteira_id: carteira, data },
      {
        onSuccess: () => {
          toast.success('Entrada salva');
          onFeito();
        },
        onError: () => toast.error('Não foi possível salvar a entrada. Tente de novo.'),
      },
    );
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <CampoValor id="entrou-valor" digitos={digitos} setDigitos={setDigitos} erro={erros.valor} />
      <SeletorCarteira id="entrou-carteira" label="Entrou em" carteiras={carteiras} value={carteira} onChange={setCarteira} />
      {erros.carteira && <p role="alert" className="text-xs text-red">{erros.carteira}</p>}
      <Input id="entrou-descricao" label="De onde veio? (opcional)" placeholder="Ex.: Freela, Pix da mãe" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <CampoData id="entrou-data" value={data} onChange={setData} hojeISO={hojeISO} />
      {erros.data && <p role="alert" className="text-xs text-red">{erros.data}</p>}
      <p className="text-[13px] text-muted">Soma no seu saldo e na renda do mês.</p>
      <Rodape onVoltar={onVoltar} salvando={entrou.isPending} rotulo="Salvar entrada" />
    </form>
  );
}

function FormTransferir({ hojeISO, carteiras, padrao, onFeito, onVoltar }: FormProps) {
  const toast = useToast();
  const transferir = useTransferir(hojeISO);
  const [digitos, setDigitos] = useState('');
  const [origem, setOrigem] = useState<string | null>(padrao);
  const [destino, setDestino] = useState<string | null>(carteiras.find((c) => c.id !== padrao)?.id ?? null);
  const [data, setData] = useState(hojeISO);
  const [erros, setErros] = useState<{ valor?: string; data?: string; carteira?: string }>({});

  const escolherOrigem = (id: string) => {
    setOrigem(id);
    if (destino === id) setDestino(carteiras.find((c) => c.id !== id)?.id ?? null);
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const { valor } = mascaraBRL(digitos);
    const novos = {
      ...validar(valor, data, hojeISO),
      ...(origem && destino && origem !== destino ? {} : { carteira: 'Escolha bancos diferentes de origem e destino.' }),
    };
    setErros(novos);
    if (Object.keys(novos).length || !origem || !destino) return;
    transferir.mutate(
      { origem_id: origem, destino_id: destino, valor, data },
      {
        onSuccess: () => {
          toast.success('Transferência feita');
          onFeito();
        },
        onError: () => toast.error('Não foi possível transferir. Tente de novo.'),
      },
    );
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <CampoValor id="transferir-valor" digitos={digitos} setDigitos={setDigitos} erro={erros.valor} />
      <SeletorCarteira id="transferir-origem" label="De" carteiras={carteiras} value={origem} onChange={escolherOrigem} />
      <SeletorCarteira id="transferir-destino" label="Para" carteiras={carteiras} value={destino} onChange={setDestino} desabilitada={origem} />
      {erros.carteira && <p role="alert" className="text-xs text-red">{erros.carteira}</p>}
      <CampoData id="transferir-data" value={data} onChange={setData} hojeISO={hojeISO} />
      {erros.data && <p role="alert" className="text-xs text-red">{erros.data}</p>}
      <p className="text-[13px] text-muted">Transferência não conta como gasto nem como renda.</p>
      <Rodape onVoltar={onVoltar} salvando={transferir.isPending} rotulo="Transferir" />
    </form>
  );
}
