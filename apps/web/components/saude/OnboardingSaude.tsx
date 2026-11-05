'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import {
  AVISO_ESTIMATIVA_SAUDE,
  FATORES_ATIVIDADE,
  calcularMetas,
  definirKcalManual,
  definirProteinaManual,
  errosRespostasSaude,
  lerFaixaProteina,
  recalcularMetas,
  usarKcalCalculada,
  usarProteinaCalculada,
  type MetasSaude,
  type NivelAtividade,
  type RespostasSaude,
} from '@meudia/shared';
import { Chip, LinkAcao, Rotulo, classeBotaoCheio } from '../caderno';

const NIVEIS: { valor: NivelAtividade; nome: string; descricao: string }[] = [
  { valor: 'leve', nome: 'Leve', descricao: 'pouco movimento no dia' },
  { valor: 'moderado', nome: 'Moderado', descricao: 'treino regular e dia ativo' },
  { valor: 'intenso', nome: 'Intenso', descricao: 'trabalho físico ou treino pesado diário' },
];

const fmtInt = (n: number) => n.toLocaleString('pt-BR');
const fmtFator = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const lerNumero = (t: string) => {
  const s = t.trim().replace(',', '.');
  return s === '' ? undefined : Number(s);
};

interface Props {
  inicial: Partial<RespostasSaude>;
  /** Metas de antes: a edição manual não é sobrescrita pelo cálculo novo. */
  metasAnteriores: MetasSaude | null;
  salvando: boolean;
  erro: string | null;
  onConcluir: (respostas: RespostasSaude, metas: MetasSaude) => void;
  onAgoraNao: () => void;
}

/** Cadastro de saúde (design-system B §5): 1/3 Sobre você, 2/3 Rotina, 3/3 Metas. */
export function OnboardingSaude({ inicial, metasAnteriores, salvando, erro, onConcluir, onAgoraNao }: Props) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [texto, setTexto] = useState({
    idade: inicial.idade ? String(inicial.idade) : '',
    alturaCm: inicial.alturaCm ? String(inicial.alturaCm) : '',
    pesoKg: inicial.pesoKg ? String(inicial.pesoKg).replace('.', ',') : '',
  });
  const [sexo, setSexo] = useState(inicial.sexo);
  const [nivel, setNivel] = useState(inicial.nivel);
  const [objetivo, setObjetivo] = useState(inicial.objetivo);
  const [tentou, setTentou] = useState(false);
  const [metasEditadas, setMetasEditadas] = useState<MetasSaude | null>(null);

  const respostas: Partial<RespostasSaude> = {
    idade: lerNumero(texto.idade),
    alturaCm: lerNumero(texto.alturaCm),
    pesoKg: lerNumero(texto.pesoKg),
    sexo,
    nivel,
    objetivo,
  };
  const erros = errosRespostasSaude(respostas);
  const errosPasso1 = (['idade', 'sexo', 'alturaCm', 'pesoKg'] as const).filter((c) => erros[c]);
  const errosPasso2 = (['nivel', 'objetivo'] as const).filter((c) => erros[c]);
  const completas = Object.keys(erros).length === 0 ? (respostas as RespostasSaude) : null;
  const calculo = useMemo(() => (completas ? calcularMetas(completas) : null), [completas?.idade, completas?.sexo, completas?.alturaCm, completas?.pesoKg, completas?.nivel, completas?.objetivo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Recalcula sempre a partir do que já foi editado: o que a pessoa definiu à mão não volta para o calculado.
  const metas = calculo ? recalcularMetas(metasEditadas ?? metasAnteriores, calculo) : null;

  const avancar = (proximo: 2 | 3, faltando: readonly string[]) => {
    setTentou(true);
    if (faltando.length > 0) return;
    setTentou(false);
    setPasso(proximo);
  };

  const agoraNao = (
    <button type="button" onClick={onAgoraNao} className="mt-3 min-h-11 w-full font-dm text-[14px] tracking-normal text-muted-text underline-offset-4 hover:underline">
      Agora não
    </button>
  );

  if (passo === 1) {
    return (
      <Tela titulo="Sobre você" passo={1} subtitulo="Só para estimar suas metas. Dá para mudar depois.">
        <CampoLinha id="onb-idade" rotulo="Idade" unidade="anos" valor={texto.idade} erro={tentou ? erros.idade : undefined} inputMode="numeric" onChange={(v) => setTexto((t) => ({ ...t, idade: v }))} />
        <div className="mt-6">
          <Rotulo id="onb-sexo">Sexo (usado só na fórmula)</Rotulo>
          <div role="group" aria-labelledby="onb-sexo" className="mt-2 flex gap-3">
            <Chip ativo={sexo === 'masculino'} onClick={() => setSexo('masculino')}>Masculino</Chip>
            <Chip ativo={sexo === 'feminino'} onClick={() => setSexo('feminino')}>Feminino</Chip>
          </div>
          {tentou && erros.sexo && <ErroCampo>{erros.sexo}</ErroCampo>}
        </div>
        <CampoLinha id="onb-altura" rotulo="Altura" unidade="cm" valor={texto.alturaCm} erro={tentou ? erros.alturaCm : undefined} inputMode="numeric" onChange={(v) => setTexto((t) => ({ ...t, alturaCm: v }))} />
        <CampoLinha id="onb-peso" rotulo="Peso atual" unidade="kg" valor={texto.pesoKg} erro={tentou ? erros.pesoKg : undefined} inputMode="decimal" onChange={(v) => setTexto((t) => ({ ...t, pesoKg: v }))} />
        <button type="button" className={clsx(classeBotaoCheio, 'mt-8')} onClick={() => avancar(2, errosPasso1)}>
          Continuar
        </button>
        {agoraNao}
      </Tela>
    );
  }

  if (passo === 2) {
    return (
      <Tela titulo="Rotina" passo={2} voltar={() => setPasso(1)}>
        <Rotulo id="onb-nivel">Atividade no dia, já com o treino</Rotulo>
        <div role="radiogroup" aria-labelledby="onb-nivel" className="mt-1">
          {NIVEIS.map((n) => {
            const ativo = nivel === n.valor;
            return (
              <button
                key={n.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setNivel(n.valor)}
                className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-white/[0.07] py-[13px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
              >
                <span className="text-[14.5px] text-muted-text">
                  <span className={clsx('text-[16px] font-bold', ativo ? 'text-accent3' : 'text-text')}>{n.nome}</span>
                  {` · ${n.descricao} · ×${fmtFator(FATORES_ATIVIDADE[n.valor])}`}
                </span>
                <span
                  aria-hidden="true"
                  className={clsx(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                    ativo ? 'bg-accent3 text-[#04201a]' : 'border-[1.5px] border-muted',
                  )}
                >
                  {ativo ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
        {tentou && erros.nivel && <ErroCampo>{erros.nivel}</ErroCampo>}
        <div className="mt-7">
          <Rotulo id="onb-objetivo">Objetivo</Rotulo>
          <div role="group" aria-labelledby="onb-objetivo" className="mt-2 flex gap-3">
            <Chip ativo={objetivo === 'manter'} onClick={() => setObjetivo('manter')}>Manter</Chip>
            <Chip ativo={objetivo === 'ganhar'} onClick={() => setObjetivo('ganhar')}>Ganhar peso</Chip>
          </div>
          {tentou && erros.objetivo && <ErroCampo>{erros.objetivo}</ErroCampo>}
        </div>
        <button
          type="button"
          className={clsx(classeBotaoCheio, 'mt-8')}
          onClick={() => avancar(3, [...errosPasso1, ...errosPasso2])}
        >
          Ver metas
        </button>
        {agoraNao}
      </Tela>
    );
  }

  if (!completas || !calculo || !metas) return null;
  return (
    <Tela titulo="Metas" passo={3} voltar={() => setPasso(2)}>
      <MetaEditavel
        rotulo="Calorias / dia"
        valor={fmtInt(metas.kcal)}
        unidade="kcal"
        apoio={`gasto estimado ${fmtInt(calculo.gasto)} kcal${completas.objetivo === 'ganhar' ? ' + 10% para ganho' : ''}`}
        origem={metas.kcalOrigem}
        calculado={metas.kcalOrigem === 'manual' && metas.kcalCalculada !== null ? `${fmtInt(metas.kcalCalculada)} kcal` : null}
        onUsarCalculada={() => setMetasEditadas(usarKcalCalculada(metas))}
        textoEdicao={String(metas.kcal)}
        aoSalvar={(t) => {
          const n = lerNumero(t);
          if (n === undefined || !Number.isFinite(n) || n < 500 || n > 10000) return 'Use um valor entre 500 e 10.000 kcal.';
          setMetasEditadas(definirKcalManual(metas, n));
          return null;
        }}
        dica="Ex.: 2950"
      />
      <MetaEditavel
        rotulo="Proteína / dia"
        valor={metas.proteinaMinG === metas.proteinaMaxG ? fmtInt(metas.proteinaMinG) : `${metas.proteinaMinG}–${metas.proteinaMaxG}`}
        unidade="g"
        apoio={`≈ ${(metas.proteinaMinG / completas.pesoKg).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g/kg`}
        origem={metas.proteinaOrigem}
        calculado={metas.proteinaOrigem === 'manual' && metas.proteinaCalculadaG !== null ? `${metas.proteinaCalculadaG} g` : null}
        onUsarCalculada={() => setMetasEditadas(usarProteinaCalculada(metas))}
        textoEdicao={metas.proteinaMinG === metas.proteinaMaxG ? String(metas.proteinaMinG) : `${metas.proteinaMinG}-${metas.proteinaMaxG}`}
        aoSalvar={(t) => {
          const faixa = lerFaixaProteina(t);
          if (!faixa) return 'Use um número (126) ou uma faixa (120-140).';
          const r = definirProteinaManual(metas, faixa, completas.pesoKg);
          if (typeof r === 'string') return r;
          setMetasEditadas(r);
          return null;
        }}
        dica="Ex.: 126 ou 120-140"
      />
      <p className="mx-5 mt-6 border-l-2 border-accent3 pl-4 text-[14.5px] leading-relaxed text-text">{AVISO_ESTIMATIVA_SAUDE}</p>
      <div className="px-5">
        {erro && (
          <p role="alert" className="mt-5 border-l-2 border-red pl-3 text-[13px] text-text">
            {erro}
          </p>
        )}
        <button type="button" disabled={salvando} className={clsx(classeBotaoCheio, 'mt-6')} onClick={() => onConcluir(completas, metas)}>
          {salvando ? 'Salvando…' : 'Salvar e começar'}
        </button>
        {agoraNao}
      </div>
    </Tela>
  );
}

function Tela({ titulo, passo, subtitulo, voltar, children }: { titulo: string; passo: number; subtitulo?: string; voltar?: () => void; children: ReactNode }) {
  return (
    <div className="pb-8">
      <header className="flex items-end justify-between gap-3 px-5 pt-4">
        <h1 className="font-syne text-[30px] font-extrabold leading-none tracking-[-0.5px] text-text">{titulo}</h1>
        <p className="text-[12px] tracking-[1.6px] text-muted-text tabular-nums" aria-label={`Passo ${passo} de 3`}>
          {passo} / 3
        </p>
      </header>
      {subtitulo && <p className="mt-3 px-5 text-[15px] text-muted-text">{subtitulo}</p>}
      {voltar && (
        <div className="px-5">
          <LinkAcao onClick={voltar}>← voltar</LinkAcao>
        </div>
      )}
      <div className={clsx(passo === 3 ? '' : 'px-5', subtitulo ? 'mt-4' : 'mt-2')}>{children}</div>
    </div>
  );
}

function ErroCampo({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 border-l-2 border-red pl-2 text-[12.5px] text-text">{children}</p>;
}

/** Campo em linha (sublinhado): número em Syne 30px, unidade à direita. */
function CampoLinha({
  id, rotulo, unidade, valor, erro, inputMode, onChange,
}: {
  id: string; rotulo: string; unidade: string; valor: string; erro?: string; inputMode: 'numeric' | 'decimal'; onChange: (v: string) => void;
}) {
  return (
    <div className="mt-6">
      <label htmlFor={id} className="block text-[10.5px] uppercase tracking-[1.6px] text-muted-text">
        {rotulo}
      </label>
      <div className={clsx('mt-1 flex items-baseline gap-2 border-b', erro ? 'border-red border-b-2' : 'border-white/25 focus-within:border-accent3')}>
        <input
          id={id}
          inputMode={inputMode}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!erro}
          className="h-14 min-w-0 flex-1 bg-transparent font-syne text-[30px] font-bold text-text tabular-nums focus:outline-none"
        />
        <span className="text-[15px] text-muted-text">{unidade}</span>
      </div>
      {erro && <ErroCampo>{erro}</ErroCampo>}
    </div>
  );
}

/** Meta em número grande com "editar" e a origem ("calculada" ou "definida por você"). */
function MetaEditavel({
  rotulo, valor, unidade, apoio, origem, calculado, onUsarCalculada, textoEdicao, aoSalvar, dica,
}: {
  rotulo: string; valor: string; unidade: string; apoio: string; origem: 'calculada' | 'manual'; calculado: string | null;
  onUsarCalculada: () => void; textoEdicao: string; aoSalvar: (texto: string) => string | null; dica: string;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(textoEdicao);
  const [erro, setErro] = useState<string | null>(null);
  const idCampo = `meta-${rotulo.split(' ')[0]!.toLowerCase()}`;
  return (
    <section className="border-b border-white/[0.07] px-5 py-[18px]">
      <Rotulo>{rotulo}</Rotulo>
      {editando ? (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const r = aoSalvar(texto);
            setErro(r);
            if (!r) setEditando(false);
          }}
        >
          <label htmlFor={idCampo} className="sr-only">{rotulo}</label>
          <div className="flex items-baseline gap-2 border-b border-accent3">
            <input
              id={idCampo}
              autoFocus
              inputMode="decimal"
              value={texto}
              placeholder={dica}
              onChange={(e) => setTexto(e.target.value)}
              className="h-14 min-w-0 flex-1 bg-transparent font-syne text-[30px] font-bold text-text tabular-nums placeholder:text-[16px] placeholder:font-normal placeholder:text-muted-text focus:outline-none"
            />
            <span className="text-[15px] text-muted-text">{unidade}</span>
          </div>
          {erro && <ErroCampo>{erro}</ErroCampo>}
          <div className="mt-1 flex gap-5">
            <LinkAcao onClick={() => { const r = aoSalvar(texto); setErro(r); if (!r) setEditando(false); }}>salvar</LinkAcao>
            <LinkAcao onClick={() => { setEditando(false); setErro(null); }}>cancelar</LinkAcao>
          </div>
        </form>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p>
              <span className="font-syne text-[44px] font-bold leading-none tracking-[-1px] text-text tabular-nums">{valor}</span>
              <span className="ml-1 text-[15px] text-muted-text">{unidade}</span>
            </p>
            <LinkAcao
              onClick={() => {
                setTexto(textoEdicao);
                setEditando(true);
              }}
              ariaLabel={`Editar ${rotulo.toLowerCase()}`}
            >
              editar
            </LinkAcao>
          </div>
          <p className="mt-2 text-[14px] text-muted-text">
            {apoio} · <span className="text-accent3">{origem === 'calculada' ? 'calculada' : 'definida por você'}</span>
          </p>
          {calculado && (
            <p className="text-[13px] text-muted-text">
              calculada: {calculado} ·{' '}
              <button type="button" onClick={onUsarCalculada} className="min-h-11 font-bold text-accent3">usar a calculada</button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
