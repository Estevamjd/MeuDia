'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DIAS_SEMANA } from '@meudia/shared';
import type { ContextoUsuario } from '@meudia/shared';

import {
  useProfile,
  useTreinos,
  useSessoesSemana,
  useHabitos,
  useRegistrosHoje,
  useResumoMensal,
  useAssinaturas,
  useTotalMensal,
  useTransacoesMes,
} from '../../../hooks';
import { useAuth } from '../../../hooks/useAuth';
import { SkeletonCard } from '../../../components/ui';
import { AgentBanner } from '../../../components/agent';

function getPeriod(hour: number): string {
  if (hour >= 5 && hour < 12) return 'manhã';
  if (hour >= 12 && hour < 18) return 'tarde';
  return 'noite';
}

export default function InicioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const hoje = useMemo(() => new Date(), []);
  const diaSemana = hoje.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  // --- Data hooks ---
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: treinos, isLoading: loadingTreinos } = useTreinos();
  const { data: sessoesSemana, isLoading: loadingSessoes } = useSessoesSemana();
  const { data: habitos, isLoading: loadingHabitos } = useHabitos();
  const { data: registrosHoje, isLoading: loadingRegistros } = useRegistrosHoje();
  const { data: resumoMensal } = useResumoMensal(hoje.getFullYear(), hoje.getMonth() + 1);
  const { data: assinaturas } = useAssinaturas();
  const { data: totalMensalAssinaturas } = useTotalMensal();
  const { data: transacoesMes } = useTransacoesMes(hoje.getFullYear(), hoje.getMonth() + 1);

  const isLoading = loadingProfile || loadingTreinos || loadingSessoes || loadingHabitos || loadingRegistros;

  // --- Derived data ---
  const treinoHoje = useMemo(() => {
    if (!treinos) return null;
    return treinos.find((t) => t.dia_semana === diaSemana) ?? null;
  }, [treinos, diaSemana]);

  const sessoesConcluidas = useMemo(() => {
    if (!sessoesSemana) return 0;
    return sessoesSemana.filter((s) => s.concluido).length;
  }, [sessoesSemana]);

  const habitosHoje = useMemo(() => {
    if (!habitos) return [];
    return habitos.filter(
      (h) => h.ativo && (h.frequencia === 'diario' || h.dias_semana.includes(diaSemana)),
    );
  }, [habitos, diaSemana]);

  const registrosMap = useMemo(() => {
    if (!registrosHoje) return new Map<string, boolean>();
    const m = new Map<string, boolean>();
    for (const r of registrosHoje) {
      if (r.concluido) m.set(r.habito_id, true);
    }
    return m;
  }, [registrosHoje]);

  const habitosConcluidos = useMemo(() => {
    return habitosHoje.filter((h) => registrosMap.has(h.id)).length;
  }, [habitosHoje, registrosMap]);

  // Hábitos toggle local state
  const [toggledHabitos, setToggledHabitos] = useState<Set<string>>(new Set());
  const toggleHabito = useCallback((id: string) => {
    setToggledHabitos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const numExercicios = treinoHoje?.exercicios?.length ?? 0;
  const saldo = resumoMensal?.saldo ?? 0;
  const despesas = resumoMensal?.totalDespesas ?? 0;

  // --- Contexto agente IA ---
  const contextoAgente: ContextoUsuario = useMemo(() => {
    const hojeStr = format(hoje, 'yyyy-MM-dd');
    const treinoHojeConcluido = sessoesSemana?.some(
      (s) => s.treino_id === treinoHoje?.id && s.data === hojeStr && s.concluido,
    ) ?? false;

    return {
      userId: user?.id ?? '',
      nome: profile?.nome ?? user?.email?.split('@')[0] ?? 'Usuário',
      objetivo: profile?.objetivo ?? null,
      horaAtual: hoje.getHours(),
      diaSemana,
      treinoHoje: treinoHoje
        ? { nome: treinoHoje.nome, exercicios: numExercicios, concluido: treinoHojeConcluido }
        : null,
      sessoesSemana: sessoesConcluidas,
      metaTreinosSemana: 5,
      habitosTotal: habitosHoje.length,
      habitosConcluidos,
      habitosPendentes: habitosHoje.filter((h) => !registrosMap.has(h.id)).map((h) => h.nome),
      percentualHabitos: habitosHoje.length > 0 ? Math.round((habitosConcluidos / habitosHoje.length) * 100) : 0,
      compromissosHoje: 0,
      proximoCompromisso: null,
      saldoMes: saldo,
      despesasMes: despesas,
      receitasMes: resumoMensal?.totalReceitas ?? 0,
      streakAtual: 0,
      scoreHoje: 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinos, sessoesSemana, habitos, registrosHoje, resumoMensal, profile, user]);

  // --- Skeleton ---
  if (isLoading) {
    return (
      <div className="animate-fadeSlide space-y-6" style={{ padding: 0 }}>
        <SkeletonCard />
        <div className="g3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        <div className="g2"><SkeletonCard /><SkeletonCard /></div>
      </div>
    );
  }

  const greeting = `Boa ${getPeriod(hoje.getHours())}! 👋`;
  const dateStr = format(hoje, "EEE, dd MMM yyyy", { locale: ptBR });

  return (
    <div className="animate-fadeSlide" style={{ padding: 0 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 className="font-syne" style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{greeting}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Resumo completo do seu dia</p>
        </div>
        <div
          style={{
            background: 'var(--card2)',
            border: '1px solid var(--border)',
            padding: '8px 16px',
            borderRadius: 20,
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          📅 {dateStr}
        </div>
      </div>

      {/* AI Banner */}
      <AgentBanner contexto={contextoAgente} />

      {/* Stat Cards — Grid 3 */}
      <div className="g3">
        {/* Saldo do Mês */}
        <div className="v3-card">
          <div className="clabel">💰 Saldo do Mês</div>
          <div className="cval" style={{ color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
            R$ {Math.abs(saldo).toLocaleString('pt-BR')}
          </div>
          <div className="csub">Receitas - Despesas</div>
          <div className={`tag ${saldo >= 0 ? 'g' : 'r'}`}>
            {saldo >= 0 ? '↑' : '↓'} Saldo {saldo >= 0 ? 'positivo' : 'negativo'}
          </div>
        </div>

        {/* Sessões da Semana */}
        <div className="v3-card">
          <div className="clabel">📊 Sessões da Semana</div>
          <div className="cval" style={{ color: 'var(--green)' }}>
            {sessoesConcluidas}/5
          </div>
          <div className="csub">Meta semanal de treinos</div>
          <div className="pbar-wrap">
            <div className="pbar-lbl"><span>{Math.round((sessoesConcluidas / 5) * 100)}%</span><span>{5 - sessoesConcluidas} restantes</span></div>
            <div className="pbar">
              <div className="pfill" style={{ width: `${Math.min((sessoesConcluidas / 5) * 100, 100)}%`, background: 'linear-gradient(90deg,var(--green),var(--accent3))' }} />
            </div>
          </div>
        </div>

        {/* Treino Hoje */}
        <div className="v3-card oc">
          <div className="clabel">🏋️ Treino Hoje</div>
          <div className="cval" style={{ color: 'var(--orange)' }}>
            {treinoHoje ? treinoHoje.nome : 'Descanso'}
          </div>
          <div className="csub">
            {treinoHoje ? `${numExercicios} exercícios` : `Sem treino para ${DIAS_SEMANA[diaSemana].toLowerCase()}`}
          </div>
          {treinoHoje && (
            <div className="tag o" onClick={() => router.push('/treinos')} style={{ cursor: 'pointer' }}>
              Ir para treino →
            </div>
          )}
        </div>
      </div>

      {/* Grid 2: Agenda + Gastos por Categoria */}
      <div className="g2">
        {/* Agenda de Hoje */}
        <div className="v3-card" style={{ cursor: 'pointer' }} onClick={() => router.push('/agenda')}>
          <div className="stitle">📅 Agenda de Hoje</div>
          <div className="alist">
            {treinoHoje && (
              <div className="aitem tr">
                <div className="atime">14:00</div>
                <div className="ainfo">
                  <div className="atitle">Treino — {treinoHoje.nome}</div>
                  <div className="asub">🏋️ {numExercicios} exercícios</div>
                </div>
                <div className="tag o" style={{ margin: 0 }}>Treino</div>
              </div>
            )}
            {habitosHoje.slice(0, 2).map((h) => {
              const feito = registrosMap.has(h.id);
              return (
                <div key={h.id} className={`aitem ${feito ? 'dn' : 'he'}`}>
                  <div className="atime">—</div>
                  <div className="ainfo">
                    <div className="atitle">{h.icone || '🔁'} {h.nome}</div>
                    <div className="asub">{feito ? '✓ Concluído' : 'Pendente'}</div>
                  </div>
                  <div className={`tag ${feito ? 'g' : 'y'}`} style={{ margin: 0 }}>{feito ? '✓' : 'Pendente'}</div>
                </div>
              );
            })}
            {!treinoHoje && habitosHoje.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>
                Nenhum compromisso para hoje
              </p>
            )}
          </div>
        </div>

        {/* Gastos por Categoria — Dados reais */}
        <div className="v3-card" style={{ cursor: 'pointer' }} onClick={() => router.push('/financas')}>
          <div className="stitle">📊 Gastos por Categoria</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
            {(() => {
              const despesasList = transacoesMes?.filter((t) => t.tipo === 'despesa') ?? [];
              if (despesasList.length === 0) {
                return (
                  <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>
                    Nenhuma despesa registrada este mes
                  </p>
                );
              }
              const porCategoria = new Map<string, number>();
              for (const t of despesasList) {
                const cat = t.categoria || 'Outros';
                porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + Number(t.valor));
              }
              const sorted = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
              const maxVal = sorted[0]?.[1] ?? 1;
              const colors = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--orange)', 'var(--yellow)'];

              return sorted.map(([cat, val], i) => (
                <div key={cat}>
                  <div className="pbar-lbl">
                    <span>{cat}</span>
                    <span>R$ {Math.round(val).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="pbar">
                    <div className="pfill" style={{ width: `${Math.round((val / maxVal) * 100)}%`, background: colors[i % colors.length] }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Grid 3: Hábitos + Notas + Assinaturas */}
      <div className="g3">
        {/* Hábitos de Hoje */}
        <div className="v3-card gc" style={{ cursor: 'pointer' }} onClick={() => router.push('/habitos')}>
          <div className="stitle">🔁 Hábitos de Hoje</div>
          <div className="hgrid">
            {habitosHoje.slice(0, 8).map((h) => {
              const feito = registrosMap.has(h.id) || toggledHabitos.has(h.id);
              return (
                <div
                  key={h.id}
                  className={`hitem ${feito ? 'done' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleHabito(h.id); }}
                >
                  {h.icone || '🔁'}
                  <span className="hlbl">{h.nome.slice(0, 8)}</span>
                </div>
              );
            })}
            {habitosHoje.length === 0 && (
              <>
                <div className="hitem">💧<span className="hlbl">Água</span></div>
                <div className="hitem">🏋️<span className="hlbl">Treino</span></div>
                <div className="hitem">📚<span className="hlbl">Leitura</span></div>
                <div className="hitem">🧘<span className="hlbl">Meditação</span></div>
              </>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>
            {habitosConcluidos} / {habitosHoje.length || '—'} hábitos concluídos ✦
          </div>
        </div>

        {/* Notas Rápidas */}
        <div className="v3-card" style={{ cursor: 'pointer' }} onClick={() => router.push('/notas')}>
          <div className="stitle">📝 Notas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              Acesse suas notas e crie lembretes rápidos.
            </p>
            <div className="tag p" style={{ margin: 0, cursor: 'pointer', width: 'fit-content' }}>
              Abrir Notas →
            </div>
          </div>
        </div>

        {/* Assinaturas — Dados reais */}
        <div className="v3-card" style={{ cursor: 'pointer' }} onClick={() => router.push('/assinaturas')}>
          <div className="stitle">🔄 Assinaturas</div>
          <div className="slist">
            {(!assinaturas || assinaturas.length === 0) ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>
                Nenhuma assinatura cadastrada
              </p>
            ) : (
              assinaturas.filter((a) => a.ativo).slice(0, 3).map((a) => {
                const hoje2 = new Date();
                const diaVenc = a.dia_vencimento;
                const diaAtual = hoje2.getDate();
                const diasRestantes = diaVenc >= diaAtual
                  ? diaVenc - diaAtual
                  : new Date(hoje2.getFullYear(), hoje2.getMonth() + 1, 0).getDate() - diaAtual + diaVenc;

                return (
                  <div key={a.id} className="sitem">
                    <div className="sico" style={{ background: `${a.cor ?? 'var(--accent)'}22` }}>
                      {a.icone || '💳'}
                    </div>
                    <div className="sinf">
                      <div className="snm">{a.nome}</div>
                      <div className="sdt">{diasRestantes} dias</div>
                    </div>
                    <div className="spr">R$ {Number(a.valor).toFixed(2).replace('.', ',')}</div>
                  </div>
                );
              })
            )}
          </div>
          {assinaturas && assinaturas.length > 0 && (
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', fontSize: 12,
            }}>
              <span style={{ color: 'var(--muted)' }}>Total mensal</span>
              <span style={{ fontWeight: 700, color: 'var(--accent2)' }}>
                R$ {(totalMensalAssinaturas ?? 0).toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
