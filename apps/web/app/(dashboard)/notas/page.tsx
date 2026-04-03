'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  StickyNote,
  Plus,
  Search,
  Trash2,
  Edit3,
  Pin,
  PinOff,
  CheckSquare,
  Square,
  Tag,
  Sparkles,
  Bell,
  ChevronDown,
  ChevronUp,
  X,
  Filter,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, isAfter, isBefore, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  Card,
  Button,
  Input,
  Textarea,
  Modal,
  Badge,
  ConfirmDialog,
  EmptyState,
  useToast,
  Skeleton,
} from '../../../components/ui';
import { useNotas } from '../../../hooks/useNotas';
import { useAuth } from '../../../hooks/useAuth';

// ── Types ──

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

// ── Constants ──

const CORES: { value: string; label: string; bg: string; border: string }[] = [
  { value: 'default', label: 'Padrão', bg: 'bg-card', border: 'border-border' },
  { value: 'purple', label: 'Roxo', bg: 'bg-accent/[0.08]', border: 'border-accent/20' },
  { value: 'green', label: 'Verde', bg: 'bg-green/[0.08]', border: 'border-green/20' },
  { value: 'orange', label: 'Laranja', bg: 'bg-orange/[0.08]', border: 'border-orange/20' },
  { value: 'red', label: 'Vermelho', bg: 'bg-red/[0.08]', border: 'border-red/20' },
  { value: 'yellow', label: 'Amarelo', bg: 'bg-yellow/[0.08]', border: 'border-yellow/20' },
];

const SUGESTOES_TAGS: Record<string, string[]> = {
  trabalho: ['reunião', 'deadline', 'projeto', 'apresentação', 'relatório', 'email', 'cliente'],
  pessoal: ['compras', 'casa', 'família', 'aniversário', 'viagem', 'lazer'],
  estudo: ['prova', 'resumo', 'aula', 'livro', 'curso', 'certificação'],
  saude: ['consulta', 'exame', 'remédio', 'treino', 'dieta', 'sono'],
  financas: ['conta', 'pagamento', 'investimento', 'orçamento', 'imposto'],
  ideias: ['projeto', 'negócio', 'criativo', 'app', 'design'],
};

// ── Helpers ──

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function autoCategorizarTags(titulo: string, conteudo: string): string[] {
  const texto = `${titulo} ${conteudo}`.toLowerCase();
  const tagsDetectadas: string[] = [];

  for (const [categoria, palavras] of Object.entries(SUGESTOES_TAGS)) {
    for (const palavra of palavras) {
      if (texto.includes(palavra)) {
        if (!tagsDetectadas.includes(categoria)) {
          tagsDetectadas.push(categoria);
        }
        break;
      }
    }
  }

  if (texto.includes('[]') || texto.includes('- [ ]') || texto.includes('todo') || texto.includes('lista')) {
    if (!tagsDetectadas.includes('checklist')) {
      tagsDetectadas.push('checklist');
    }
  }

  return tagsDetectadas;
}

function resumirNota(conteudo: string, maxLen = 120): string {
  if (conteudo.length <= maxLen) return conteudo;
  return conteudo.slice(0, maxLen).trim() + '...';
}

// ── Components ──

function TagBadge({ tag, removable, onRemove }: { tag: string; removable?: boolean; onRemove?: () => void }) {
  const colors: Record<string, string> = {
    trabalho: 'bg-accent/[0.14] text-accent border-accent/20',
    pessoal: 'bg-green/[0.14] text-green border-green/20',
    estudo: 'bg-orange/[0.14] text-orange border-orange/20',
    saude: 'bg-red/[0.14] text-red border-red/20',
    financas: 'bg-yellow/[0.14] text-yellow border-yellow/20',
    ideias: 'bg-accent2/[0.14] text-accent2 border-accent2/20',
    checklist: 'bg-muted/[0.14] text-muted border-muted/20',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        colors[tag] ?? 'bg-card2 text-muted border-border',
      )}
    >
      <Tag size={9} />
      {tag}
      {removable && onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:text-red transition-colors" aria-label={`Remover tag ${tag}`}>
          <X size={9} />
        </button>
      )}
    </span>
  );
}

// ── Main Page ──

export default function NotasPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { notas, isLoading, criarNota, atualizarNota, excluirNota } = useNotas();
  const migracaoFeita = useRef(false);

  // State
  const [busca, setBusca] = useState('');
  const [filtroTag, setFiltroTag] = useState<string | null>(null);
  const [showFiltros, setShowFiltros] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editandoNotaId, setEditandoNotaId] = useState<string | null>(null);
  const [deletandoNotaId, setDeletandoNotaId] = useState<string | null>(null);
  const [expandedNota, setExpandedNota] = useState<string | null>(null);

  // Form state
  const [formTitulo, setFormTitulo] = useState('');
  const [formConteudo, setFormConteudo] = useState('');
  const [formCor, setFormCor] = useState('default');
  const [formChecklist, setFormChecklist] = useState<ChecklistItem[]>([]);
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formNewTag, setFormNewTag] = useState('');
  const [formLembrete, setFormLembrete] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);

  // Migração automática de localStorage para Supabase
  useEffect(() => {
    if (!user || migracaoFeita.current || isLoading) return;
    if (notas.length > 0) { migracaoFeita.current = true; return; }
    const raw = localStorage.getItem('meudia_notas');
    if (!raw) { migracaoFeita.current = true; return; }
    try {
      const notasLocais = JSON.parse(raw);
      if (Array.isArray(notasLocais) && notasLocais.length > 0) {
        migracaoFeita.current = true;
        Promise.all(
          notasLocais.map((n: Record<string, unknown>) =>
            criarNota.mutateAsync({
              titulo: (n.titulo as string) || '',
              conteudo: (n.conteudo as string) || '',
              tags: (n.tags as string[]) || [],
              cor: (n.cor as string) || 'default',
              fixada: (n.fixada as boolean) || false,
              checklist: (n.checklist as ChecklistItem[]) || [],
              lembrete: (n.lembrete as string) || null,
            })
          )
        ).then(() => {
          localStorage.removeItem('meudia_notas');
          toast.success('Notas migradas para a nuvem!');
        }).catch(() => {
          migracaoFeita.current = false;
        });
      } else {
        migracaoFeita.current = true;
      }
    } catch {
      migracaoFeita.current = true;
    }
  }, [user, notas.length, isLoading, criarNota, toast]);

  // Check reminders
  useEffect(() => {
    const interval = setInterval(() => {
      const agora = new Date();
      notas.forEach((nota) => {
        if (nota.lembrete && isAfter(agora, new Date(nota.lembrete)) && isBefore(new Date(nota.lembrete), addMinutes(agora, 1))) {
          toast.info(`Lembrete: ${nota.titulo}`);
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [notas, toast]);

  // ── Derived ──

  const todasTags = useMemo(() => {
    const tagSet = new Set<string>();
    notas.forEach((n) => n.tags.forEach((t: string) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [notas]);

  const notasFiltradas = useMemo(() => {
    let resultado = [...notas];

    if (busca.trim()) {
      const termo = busca.toLowerCase();
      resultado = resultado.filter(
        (n) =>
          n.titulo.toLowerCase().includes(termo) ||
          n.conteudo.toLowerCase().includes(termo) ||
          n.tags.some((t: string) => t.includes(termo)) ||
          n.checklist.some((c: ChecklistItem) => c.text.toLowerCase().includes(termo)),
      );
    }

    if (filtroTag) {
      resultado = resultado.filter((n) => n.tags.includes(filtroTag));
    }

    resultado.sort((a, b) => {
      if (a.fixada && !b.fixada) return -1;
      if (!a.fixada && b.fixada) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return resultado;
  }, [notas, busca, filtroTag]);

  const editandoNota = editandoNotaId ? notas.find((n) => n.id === editandoNotaId) ?? null : null;
  const deletandoNota = deletandoNotaId ? notas.find((n) => n.id === deletandoNotaId) ?? null : null;

  // ── Handlers ──

  const resetForm = useCallback(() => {
    setFormTitulo('');
    setFormConteudo('');
    setFormCor('default');
    setFormChecklist([]);
    setFormTags([]);
    setFormNewTag('');
    setFormLembrete('');
    setShowChecklist(false);
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    setEditandoNotaId(null);
    setShowAddModal(true);
  }, [resetForm]);

  const openEditModal = useCallback((nota: typeof notas[number]) => {
    setFormTitulo(nota.titulo);
    setFormConteudo(nota.conteudo);
    setFormCor(nota.cor);
    setFormChecklist([...nota.checklist]);
    setFormTags([...nota.tags]);
    setFormLembrete(nota.lembrete ? nota.lembrete.slice(0, 16) : '');
    setShowChecklist(nota.checklist.length > 0);
    setEditandoNotaId(nota.id);
    setShowAddModal(true);
  }, []);

  const handleSalvar = useCallback(async () => {
    if (!formTitulo.trim()) {
      toast.warning('Dê um título para sua nota');
      return;
    }

    const autoTags = autoCategorizarTags(formTitulo, formConteudo);
    const mergedTags = Array.from(new Set([...formTags, ...autoTags]));

    try {
      if (editandoNota) {
        await atualizarNota.mutateAsync({
          id: editandoNota.id,
          titulo: formTitulo.trim(),
          conteudo: formConteudo.trim(),
          cor: formCor,
          checklist: formChecklist,
          tags: mergedTags,
          lembrete: formLembrete ? new Date(formLembrete).toISOString() : null,
        });
        toast.success('Nota atualizada!');
      } else {
        await criarNota.mutateAsync({
          titulo: formTitulo.trim(),
          conteudo: formConteudo.trim(),
          tags: mergedTags,
          cor: formCor,
          fixada: false,
          checklist: formChecklist,
          lembrete: formLembrete ? new Date(formLembrete).toISOString() : null,
        });
        toast.success('Nota criada!');
      }
      setShowAddModal(false);
      resetForm();
    } catch {
      toast.error('Erro ao salvar nota');
    }
  }, [formTitulo, formConteudo, formCor, formChecklist, formTags, formLembrete, editandoNota, toast, resetForm, criarNota, atualizarNota]);

  const handleExcluir = useCallback(async () => {
    if (!deletandoNota) return;
    try {
      await excluirNota.mutateAsync(deletandoNota.id);
      toast.success('Nota excluída');
    } catch {
      toast.error('Erro ao excluir nota');
    }
    setDeletandoNotaId(null);
  }, [deletandoNota, excluirNota, toast]);

  const toggleFixar = useCallback(async (id: string) => {
    const nota = notas.find((n) => n.id === id);
    if (!nota) return;
    await atualizarNota.mutateAsync({ id, fixada: !nota.fixada });
  }, [notas, atualizarNota]);

  const toggleChecklistItem = useCallback(async (notaId: string, itemId: string) => {
    const nota = notas.find((n) => n.id === notaId);
    if (!nota) return;
    const updatedChecklist = nota.checklist.map((c: ChecklistItem) =>
      c.id === itemId ? { ...c, checked: !c.checked } : c,
    );
    await atualizarNota.mutateAsync({ id: notaId, checklist: updatedChecklist });
  }, [notas, atualizarNota]);

  const addChecklistItem = useCallback(() => {
    setFormChecklist((prev) => [...prev, { id: gerarId(), text: '', checked: false }]);
  }, []);

  const updateChecklistItem = useCallback((id: string, text: string) => {
    setFormChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
  }, []);

  const removeChecklistItem = useCallback((id: string) => {
    setFormChecklist((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addTag = useCallback(() => {
    const tag = formNewTag.trim().toLowerCase();
    if (tag && !formTags.includes(tag)) {
      setFormTags((prev) => [...prev, tag]);
    }
    setFormNewTag('');
  }, [formNewTag, formTags]);

  const removeTag = useCallback((tag: string) => {
    setFormTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // ── Cor helpers ──

  const getCorClasses = useCallback((cor: string) => {
    return CORES.find((c) => c.value === cor) ?? CORES[0]!;
  }, []);

  // ── Stats ──

  const stats = useMemo(() => {
    const total = notas.length;
    const comChecklist = notas.filter((n) => n.checklist.length > 0).length;
    const comLembrete = notas.filter((n) => n.lembrete).length;
    const fixadas = notas.filter((n) => n.fixada).length;
    return { total, comChecklist, comLembrete, fixadas };
  }, [notas]);

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne text-3xl font-bold text-text">Bloco de Notas</h1>
          <p className="mt-1 text-sm text-muted">
            {stats.total} {stats.total === 1 ? 'nota' : 'notas'} · Organização inteligente
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus size={16} />
          Nova Nota
        </Button>
      </div>

      {/* Smart Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="!p-4 text-center">
            <div className="text-2xl font-bold text-text">{stats.total}</div>
            <div className="text-xs text-muted">Total</div>
          </Card>
          <Card className="!p-4 text-center">
            <div className="text-2xl font-bold text-accent">{stats.fixadas}</div>
            <div className="text-xs text-muted">Fixadas</div>
          </Card>
          <Card className="!p-4 text-center">
            <div className="text-2xl font-bold text-green">{stats.comChecklist}</div>
            <div className="text-xs text-muted">Com checklist</div>
          </Card>
          <Card className="!p-4 text-center">
            <div className="text-2xl font-bold text-orange">{stats.comLembrete}</div>
            <div className="text-xs text-muted">Com lembrete</div>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar notas, tags, checklists..."
              icon={<Search size={16} />}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {todasTags.length > 0 && (
            <button
              onClick={() => setShowFiltros(!showFiltros)}
              className={clsx(
                'flex items-center gap-2 rounded-lg border px-4 text-sm transition-colors',
                showFiltros
                  ? 'border-accent/30 bg-accent/[0.08] text-accent'
                  : 'border-border bg-card2 text-muted hover:text-text',
              )}
            >
              <Filter size={14} />
              Filtros
              {filtroTag && <Badge color="purple">1</Badge>}
            </button>
          )}
        </div>

        {showFiltros && todasTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
            <span className="text-xs text-muted">Tags:</span>
            <button
              onClick={() => setFiltroTag(null)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                !filtroTag ? 'bg-accent text-white' : 'bg-card2 text-muted hover:text-text',
              )}
            >
              Todas
            </button>
            {todasTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFiltroTag(filtroTag === tag ? null : tag)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filtroTag === tag ? 'bg-accent text-white' : 'bg-card2 text-muted hover:text-text',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes Grid */}
      {notasFiltradas.length === 0 ? (
        notas.length === 0 ? (
          <EmptyState
            icon={<StickyNote size={48} />}
            title="Nenhuma nota ainda"
            description="Crie sua primeira nota inteligente. Ela será categorizada automaticamente por IA."
            actionLabel="Criar nota"
            onAction={openAddModal}
          />
        ) : (
          <Card className="py-12 text-center">
            <Search size={32} className="mx-auto mb-3 text-muted" />
            <p className="text-sm text-muted">Nenhuma nota encontrada para &quot;{busca || filtroTag}&quot;</p>
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notasFiltradas.map((nota) => {
            const corInfo = getCorClasses(nota.cor);
            const isExpanded = expandedNota === nota.id;
            const checkDone = nota.checklist.filter((c: ChecklistItem) => c.checked).length;
            const checkTotal = nota.checklist.length;

            return (
              <div
                key={nota.id}
                className={clsx(
                  'group rounded-card border p-5 transition-all hover:shadow-lg hover:shadow-black/20',
                  corInfo.bg,
                  corInfo.border,
                  nota.fixada && 'ring-1 ring-accent/30',
                )}
              >
                {/* Note Header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {nota.fixada && <Pin size={12} className="shrink-0 text-accent" />}
                      <h3 className="truncate font-syne text-sm font-bold text-text">{nota.titulo}</h3>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {format(new Date(nota.updated_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => toggleFixar(nota.id)}
                      className="rounded p-1.5 text-muted transition-colors hover:bg-card2 hover:text-accent"
                      aria-label={nota.fixada ? 'Desafixar' : 'Fixar'}
                    >
                      {nota.fixada ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    <button
                      onClick={() => openEditModal(nota)}
                      className="rounded p-1.5 text-muted transition-colors hover:bg-card2 hover:text-text"
                      aria-label="Editar"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => setDeletandoNotaId(nota.id)}
                      className="rounded p-1.5 text-muted transition-colors hover:bg-card2 hover:text-red"
                      aria-label="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                {nota.conteudo && (
                  <p className="mb-3 text-xs leading-relaxed text-muted">
                    {isExpanded ? nota.conteudo : resumirNota(nota.conteudo)}
                  </p>
                )}

                {nota.conteudo.length > 120 && (
                  <button
                    onClick={() => setExpandedNota(isExpanded ? null : nota.id)}
                    className="mb-3 flex items-center gap-1 text-[10px] text-accent transition-colors hover:text-accent2"
                  >
                    {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    {isExpanded ? 'Ver menos' : 'Ver mais'}
                  </button>
                )}

                {/* Checklist Preview */}
                {nota.checklist.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {nota.checklist.slice(0, isExpanded ? undefined : 3).map((item: ChecklistItem) => (
                      <button
                        key={item.id}
                        onClick={() => toggleChecklistItem(nota.id, item.id)}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        {item.checked ? (
                          <CheckSquare size={14} className="shrink-0 text-green" />
                        ) : (
                          <Square size={14} className="shrink-0 text-muted" />
                        )}
                        <span
                          className={clsx(
                            'text-xs',
                            item.checked ? 'text-muted line-through' : 'text-text',
                          )}
                        >
                          {item.text}
                        </span>
                      </button>
                    ))}
                    {checkTotal > 0 && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-card2">
                          <div
                            className="h-full rounded-full bg-green transition-all"
                            style={{ width: `${(checkDone / checkTotal) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted">
                          {checkDone}/{checkTotal}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer: Tags & Reminder */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {nota.tags.map((tag: string) => (
                    <TagBadge key={tag} tag={tag} />
                  ))}
                  {nota.lembrete && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-orange/20 bg-orange/[0.08] px-2 py-0.5 text-[10px] text-orange">
                      <Bell size={9} />
                      {format(new Date(nota.lembrete), 'dd/MM HH:mm')}
                    </span>
                  )}
                </div>

                {/* AI indicator */}
                {nota.tags.length > 0 && (
                  <div className="mt-3 flex items-center gap-1 text-[10px] text-muted/60">
                    <Sparkles size={9} />
                    Tags sugeridas por IA
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title={editandoNota ? 'Editar Nota' : 'Nova Nota'}
        className="!max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Título"
            placeholder="Do que se trata essa nota?"
            value={formTitulo}
            onChange={(e) => setFormTitulo(e.target.value)}
          />

          <Textarea
            label="Conteúdo"
            placeholder="Escreva aqui... A IA vai categorizar automaticamente."
            value={formConteudo}
            onChange={(e) => setFormConteudo(e.target.value)}
            rows={4}
          />

          {/* Color Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted">Cor</label>
            <div className="flex gap-2">
              {CORES.map((cor) => (
                <button
                  key={cor.value}
                  onClick={() => setFormCor(cor.value)}
                  className={clsx(
                    'h-7 w-7 rounded-full border-2 transition-all',
                    cor.bg,
                    formCor === cor.value ? 'border-accent scale-110' : 'border-border hover:border-muted',
                  )}
                  aria-label={cor.label}
                  title={cor.label}
                />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted">
              <Tag size={12} className="mr-1 inline" />
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {formTags.map((tag) => (
                <TagBadge key={tag} tag={tag} removable onRemove={() => removeTag(tag)} />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-border bg-card2 px-3 py-1.5 text-xs text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
                placeholder="Adicionar tag..."
                value={formNewTag}
                onChange={(e) => setFormNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <button
                onClick={addTag}
                className="rounded-lg bg-card2 px-3 py-1.5 text-xs text-muted transition-colors hover:text-accent"
              >
                <Plus size={12} />
              </button>
            </div>
            {formTags.length === 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-[10px] text-muted/50">Sugestões:</span>
                {Object.keys(SUGESTOES_TAGS)
                  .slice(0, 5)
                  .map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (!formTags.includes(tag)) setFormTags((prev) => [...prev, tag]);
                      }}
                      className="text-[10px] text-accent/60 hover:text-accent transition-colors"
                    >
                      +{tag}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Checklist Toggle */}
          <div>
            <button
              onClick={() => {
                setShowChecklist(!showChecklist);
                if (!showChecklist && formChecklist.length === 0) {
                  addChecklistItem();
                }
              }}
              className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-accent"
            >
              <CheckSquare size={14} />
              {showChecklist ? 'Esconder checklist' : 'Adicionar checklist'}
            </button>

            {showChecklist && (
              <div className="mt-3 space-y-2">
                {formChecklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Square size={14} className="shrink-0 text-muted" />
                    <input
                      className="flex-1 rounded border-none bg-transparent text-xs text-text placeholder:text-muted/40 focus:outline-none"
                      placeholder="Item do checklist..."
                      value={item.text}
                      onChange={(e) => updateChecklistItem(item.id, e.target.value)}
                    />
                    <button
                      onClick={() => removeChecklistItem(item.id)}
                      className="text-muted hover:text-red transition-colors"
                      aria-label="Remover item"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addChecklistItem}
                  className="flex items-center gap-1 text-[11px] text-accent/70 transition-colors hover:text-accent"
                >
                  <Plus size={11} />
                  Adicionar item
                </button>
              </div>
            )}
          </div>

          {/* Reminder */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted">
              <Bell size={12} className="mr-1 inline" />
              Lembrete (opcional)
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-border bg-card2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              value={formLembrete}
              onChange={(e) => setFormLembrete(e.target.value)}
            />
          </div>

          {/* AI auto-tag preview */}
          {(formTitulo || formConteudo) && (
            <div className="rounded-lg border border-accent/10 bg-accent/[0.04] p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-accent">
                <Sparkles size={12} />
                Tags detectadas pela IA
              </div>
              <div className="flex flex-wrap gap-1.5">
                {autoCategorizarTags(formTitulo, formConteudo).length > 0 ? (
                  autoCategorizarTags(formTitulo, formConteudo).map((tag) => (
                    <TagBadge key={tag} tag={tag} />
                  ))
                ) : (
                  <span className="text-[10px] text-muted/50">
                    Continue escrevendo... a IA vai detectar categorias automaticamente.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="flex-1 bg-card2 text-muted hover:text-text"
            >
              Cancelar
            </Button>
            <Button onClick={handleSalvar} className="flex-1">
              {editandoNota ? 'Salvar' : 'Criar Nota'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletandoNota}
        onClose={() => setDeletandoNotaId(null)}
        onConfirm={handleExcluir}
        title="Excluir nota"
        message={`Tem certeza que deseja excluir "${deletandoNota?.titulo}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}
