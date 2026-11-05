'use client';

import { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  RITMOS_SEMANAIS_PCT,
  mediaPeso,
  metaRealista,
  ritmoKgSemana,
  serieGraficoPeso,
  ultimoPeso,
} from '@meudia/shared';
import { hojeLocal, usePerfilSaude, usePesoRecente, useProfile, useRegistrarPesoDoDia, useUpdateProfile } from '../../../../hooks';
import { Cabecalho, Chip, LinkAcao, Rotulo, Secao, Subabas, TelaCaderno, VazioCaderno, classeBotaoCheio, classeTextoCaderno } from '../../../../components/caderno';
import { GraficoPeso } from '../../../../components/saude/GraficoPeso';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Modal } from '../../../../components/ui/Modal';
import { SkeletonList } from '../../../../components/ui/Skeleton';
import { useToast } from '../../../../components/ui/Toast';
import { perfilVazio } from '../../../../lib/perfil-saude';

const PERIODOS = [7, 30, 90] as const;
const fmtKg = (n: number, casas = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtPct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const fmtData = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').replace(' de ', ' ');
const lerNumero = (t: string) => {
  const s = t.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** Saúde · Peso (tela 04 + bloco de meta). Só peso: sem fotos e sem outras medidas. */
export default function SaudePesoPage() {
  const toast = useToast();
  const hoje = hojeLocal();
  const pesoQ = usePesoRecente();
  const profileQ = useProfile();
  const atualizarPerfil = useUpdateProfile();
  const registrar = useRegistrarPesoDoDia();
  const { perfil, salvar } = usePerfilSaude();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const [registrando, setRegistrando] = useState(false);
  const [editandoMeta, setEditandoMeta] = useState(false);

  const registros = useMemo(() => pesoQ.data ?? [], [pesoQ.data]);
  const media7 = mediaPeso(registros, hoje, 7);
  const ultimo = ultimoPeso(registros);
  const atual = media7 ?? ultimo?.peso ?? null;
  const metaKg = profileQ.data?.meta_peso ? Number(profileQ.data.meta_peso) : null;
  const prazo = perfil?.prazoMeta ?? null;
  const ritmo = perfil?.ritmoPct ?? RITMOS_SEMANAIS_PCT[1];
  const realista = metaKg && atual && prazo ? metaRealista({ pesoMetaKg: metaKg, pesoAtualKg: atual, hoje, prazo }) : null;

  const guardarLocal = (mudanca: { ritmoPct?: number; prazoMeta?: string | null }) =>
    salvar({ ...(perfil ?? perfilVazio('adiado')), ...mudanca });

  const salvarPeso = async (peso: number) => {
    try {
      await registrar.mutateAsync({ peso, data: hoje });
      setRegistrando(false);
      toast.success('Peso de hoje salvo.');
    } catch {
      toast.error('Não deu para salvar o peso. Tente de novo.');
    }
  };

  const salvarMeta = async (peso: number | null, data: string | null) => {
    try {
      await atualizarPerfil.mutateAsync({ meta_peso: peso });
      guardarLocal({ prazoMeta: data });
      setEditandoMeta(false);
    } catch {
      toast.error('Não deu para salvar o peso-meta. Tente de novo.');
    }
  };

  let conteudo;
  if (pesoQ.isLoading) {
    conteudo = (
      <div className="px-5 py-[18px]" aria-busy="true" aria-label="Carregando peso">
        <SkeletonList count={3} />
      </div>
    );
  } else if (pesoQ.isError) {
    conteudo = (
      <EmptyState
        icon={<AlertCircle size={36} aria-hidden="true" />}
        title="Não deu para carregar o peso."
        description="Confira a conexão e tente de novo."
        actionLabel="Tentar de novo"
        onAction={() => void pesoQ.refetch()}
      />
    );
  } else if (registros.length === 0) {
    conteudo = (
      <VazioCaderno
        rotulo="Peso"
        titulo="Nenhum peso ainda."
        explicacao="O gráfico aparece depois do primeiro registro."
        acao="Registrar peso de hoje"
        onAcao={() => setRegistrando(true)}
      />
    );
  } else {
    conteudo = (
      <>
        <Secao>
          <p>
            <span className="font-syne text-[44px] font-bold leading-none tracking-[-1px] text-text tabular-nums">{fmtKg(atual!)}</span>
            <span className="ml-1 text-[15px] text-muted-text">kg</span>
          </p>
          {media7 === null && ultimo && <p className="mt-1 text-[13px] text-muted-text">Último registro em {fmtData(ultimo.data)}.</p>}
          <div role="group" aria-label="Período do gráfico" className="mt-4 flex gap-3">
            {PERIODOS.map((p) => (
              <Chip key={p} ativo={dias === p} onClick={() => setDias(p)}>
                {p} dias
              </Chip>
            ))}
          </div>
          <div className="mt-4">
            <GraficoPeso pontos={serieGraficoPeso(registros, hoje, dias)} metaKg={metaKg} />
          </div>
        </Secao>

        <Secao>
          <Rotulo>Peso-meta</Rotulo>
          <div className="flex items-center justify-between gap-3">
            <div>
              {metaKg ? (
                <p>
                  <span className="font-syne text-[22px] font-bold text-text tabular-nums">{fmtKg(metaKg)}</span>
                  <span className="ml-1 text-[15px] text-muted-text">kg{prazo ? ` · até ${fmtData(prazo)}` : ''}</span>
                </p>
              ) : (
                <p className="text-[14.5px] text-muted-text">Sem peso-meta.</p>
              )}
            </div>
            <LinkAcao onClick={() => setEditandoMeta(true)} ariaLabel="Editar peso-meta">
              {metaKg ? 'editar' : 'definir'}
            </LinkAcao>
          </div>
          <Rotulo id="ritmo" className="mt-5">Ritmo por semana (% do peso)</Rotulo>
          <div role="group" aria-labelledby="ritmo" className="mt-2 flex gap-3">
            {RITMOS_SEMANAIS_PCT.map((p) => (
              <Chip key={p} ativo={ritmo === p} onClick={() => guardarLocal({ ritmoPct: p })}>
                {fmtPct(p)}%
              </Chip>
            ))}
          </div>
          {atual && (
            <p className="mt-2 text-[14px] text-muted-text tabular-nums">
              {fmtPct(ritmo)}% de {fmtKg(atual)} kg ≈ {fmtKg(ritmoKgSemana(ritmo, atual), 2)} kg/semana
            </p>
          )}
        </Secao>

        <Secao rotulo="Meta realista">
          {realista ? (
            realista.pedidoKgSemana > 0 ? (
              <p className="text-[15.5px] leading-relaxed text-text">
                Nesse prazo a meta pede <strong>{fmtKg(realista.pedidoKgSemana, 2)} kg/semana</strong>; a referência é{' '}
                <strong>
                  {fmtKg(realista.refMinKgSemana, 2)}–{fmtKg(realista.refMaxKgSemana, 2)} kg/semana
                </strong>
                .
              </p>
            ) : (
              <p className="text-[15.5px] text-text">O peso-meta já está no peso atual ou abaixo dele.</p>
            )
          ) : (
            <p className="text-[14.5px] text-muted-text">
              {metaKg ? 'Defina a data do peso-meta para comparar o ritmo.' : 'Defina o peso-meta e a data para comparar o ritmo.'}
            </p>
          )}
          <p className="mt-2 text-[12.5px] text-muted-text">Referência: 0,25% a 0,5% do peso por semana (Iraki et al., 2019).</p>
        </Secao>

        <div className="px-5 py-5">
          <button type="button" className={classeBotaoCheio} onClick={() => setRegistrando(true)}>
            Registrar peso de hoje
          </button>
        </div>
      </>
    );
  }

  return (
    <TelaCaderno>
      <Cabecalho titulo="Peso" contexto={registros.length > 0 ? (media7 !== null ? 'média 7 dias' : 'último registro') : undefined} />
      <Subabas />
      {conteudo}

      <CampoModal
        aberto={registrando}
        titulo="Peso de hoje"
        campos={[{ id: 'peso-hoje', rotulo: 'Peso', unidade: 'kg', inicial: ultimo?.data === hoje ? fmtKg(ultimo.peso) : '' }]}
        salvando={registrar.isPending}
        onFechar={() => setRegistrando(false)}
        onSalvar={([t]) => {
          const n = lerNumero(t ?? '');
          if (n === null || Number.isNaN(n) || n < 20 || n > 300) return 'Use um peso entre 20 e 300 kg.';
          void salvarPeso(Math.round(n * 100) / 100);
          return null;
        }}
        nota={ultimo?.data === hoje ? 'Já tem peso hoje: salvar corrige o valor do dia.' : undefined}
      />
      <CampoModal
        aberto={editandoMeta}
        titulo="Peso-meta"
        campos={[
          { id: 'meta-peso', rotulo: 'Peso-meta', unidade: 'kg', inicial: metaKg ? fmtKg(metaKg) : '' },
          { id: 'meta-prazo', rotulo: 'Até', unidade: '', inicial: prazo ?? '', tipo: 'date' },
        ]}
        salvando={atualizarPerfil.isPending}
        onFechar={() => setEditandoMeta(false)}
        onSalvar={([tPeso, tData]) => {
          const n = lerNumero(tPeso ?? '');
          if (n !== null && (Number.isNaN(n) || n < 20 || n > 300)) return 'Use um peso entre 20 e 300 kg.';
          const data = tData?.trim() ? tData.trim() : null;
          if (data && data <= hoje) return 'A data precisa ser depois de hoje.';
          void salvarMeta(n, data);
          return null;
        }}
        nota="A data fica guardada neste aparelho até a próxima atualização do app."
      />
    </TelaCaderno>
  );
}

function CampoModal({
  aberto, titulo, campos, salvando, onFechar, onSalvar, nota,
}: {
  aberto: boolean;
  titulo: string;
  campos: { id: string; rotulo: string; unidade: string; inicial: string; tipo?: 'date' }[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (valores: string[]) => string | null;
  nota?: string;
}) {
  return (
    <Modal isOpen={aberto} onClose={onFechar} title={titulo}>
      {aberto && <FormCampos key={campos.map((c) => c.inicial).join('|')} campos={campos} salvando={salvando} onSalvar={onSalvar} nota={nota} />}
    </Modal>
  );
}

function FormCampos({
  campos, salvando, onSalvar, nota,
}: {
  campos: { id: string; rotulo: string; unidade: string; inicial: string; tipo?: 'date' }[];
  salvando: boolean;
  onSalvar: (valores: string[]) => string | null;
  nota?: string;
}) {
  const [valores, setValores] = useState(campos.map((c) => c.inicial));
  const [erro, setErro] = useState<string | null>(null);
  return (
    <form
      className={`flex flex-col gap-5 ${classeTextoCaderno}`}
      onSubmit={(e) => {
        e.preventDefault();
        setErro(onSalvar(valores));
      }}
    >
      {campos.map((c, i) => (
        <div key={c.id}>
          <label htmlFor={c.id} className="block text-[10.5px] uppercase tracking-[1.6px] text-muted-text">
            {c.rotulo}
          </label>
          <div className="mt-1 flex items-baseline gap-2 border-b border-white/25 focus-within:border-accent3">
            <input
              id={c.id}
              type={c.tipo ?? 'text'}
              inputMode={c.tipo ? undefined : 'decimal'}
              autoFocus={i === 0}
              value={valores[i]}
              onChange={(e) => setValores((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-14 min-w-0 flex-1 bg-transparent font-syne text-[26px] font-bold text-text tabular-nums [color-scheme:dark] focus:outline-none"
            />
            {c.unidade && <span className="text-[15px] text-muted-text">{c.unidade}</span>}
          </div>
        </div>
      ))}
      {nota && <p className="text-[13px] text-muted-text">{nota}</p>}
      {erro && (
        <p role="alert" className="border-l-2 border-red pl-3 text-[13px] text-text">
          {erro}
        </p>
      )}
      <button type="submit" disabled={salvando} className={classeBotaoCheio}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}
