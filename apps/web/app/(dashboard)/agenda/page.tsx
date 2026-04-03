'use client';

import { useState, useMemo, useCallback } from 'react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Edit3,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Compromisso, CompromissoInsert } from '@meudia/shared';

import {
  useCompromissosPorData,
  useCriarCompromisso,
  useAtualizarCompromisso,
  useExcluirCompromisso,
  useMarcarConcluido,
} from '../../../hooks';

import {
  Badge,
  Button,
  Modal,
  ConfirmDialog,
  EmptyState,
  SkeletonList,
  useToast,
  Input,
  Select,
  Textarea,
} from '../../../components/ui';
import { AgentBannerAuto } from '../../../components/agent';

const PRIORIDADE_COLORS: Record<string, 'red' | 'orange' | 'yellow' | 'green'> = {
  urgente: 'red',
  alta: 'orange',
  media: 'yellow',
  baixa: 'green',
};

const PRIORIDADE_LABELS: Record<string, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'Media',
  baixa: 'Baixa',
};

const TIPO_OPTIONS = [
  { value: 'geral', label: 'Geral' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'saude', label: 'Saude' },
  { value: 'estudo', label: 'Estudo' },
];

interface CompromissoFormData {
  titulo: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  local: string;
  tipo: string;
  prioridade: string;
}

const emptyForm: CompromissoFormData = {
  titulo: '',
  descricao: '',
  data_inicio: '',
  data_fim: '',
  local: '',
  tipo: 'geral',
  prioridade: 'media',
};

export default function AgendaPage() {
  const toast = useToast();

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Data
  const { data: compromissos, isLoading } = useCompromissosPorData(dateStr);

  // Mutations
  const criarCompromisso = useCriarCompromisso();
  const atualizarCompromisso = useAtualizarCompromisso();
  const excluirCompromisso = useExcluirCompromisso();
  const marcarConcluido = useMarcarConcluido();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCompromisso, setEditingCompromisso] = useState<Compromisso | null>(null);
  const [deletingCompromisso, setDeletingCompromisso] = useState<Compromisso | null>(null);
  const [formData, setFormData] = useState<CompromissoFormData>(emptyForm);

  // Formatted date
  const formattedDate = format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

  // Group compromissos by hour
  const groupedCompromissos = useMemo(() => {
    if (!compromissos || compromissos.length === 0) return new Map<string, Compromisso[]>();

    const groups = new Map<string, Compromisso[]>();
    for (const c of compromissos) {
      const hour = format(parseISO(c.data_inicio), 'HH:mm');
      const existing = groups.get(hour) || [];
      existing.push(c);
      groups.set(hour, existing);
    }
    return groups;
  }, [compromissos]);

  // Navigation handlers
  const goToPrevDay = useCallback(() => setSelectedDate((d) => subDays(d, 1)), []);
  const goToNextDay = useCallback(() => setSelectedDate((d) => addDays(d, 1)), []);
  const goToToday = useCallback(() => setSelectedDate(new Date()), []);

  // Open add modal
  const handleOpenAdd = useCallback(() => {
    const defaultDateTime = format(selectedDate, "yyyy-MM-dd'T'09:00");
    setFormData({ ...emptyForm, data_inicio: defaultDateTime });
    setEditingCompromisso(null);
    setShowModal(true);
  }, [selectedDate]);

  // Open edit modal
  const handleOpenEdit = useCallback((compromisso: Compromisso) => {
    setEditingCompromisso(compromisso);
    setFormData({
      titulo: compromisso.titulo,
      descricao: compromisso.descricao || '',
      data_inicio: compromisso.data_inicio.slice(0, 16),
      data_fim: compromisso.data_fim ? compromisso.data_fim.slice(0, 16) : '',
      local: compromisso.local || '',
      tipo: compromisso.tipo,
      prioridade: compromisso.prioridade,
    });
    setShowModal(true);
  }, []);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingCompromisso(null);
    setFormData(emptyForm);
  }, []);

  // Submit form
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const payload: CompromissoInsert = {
        titulo: formData.titulo,
        descricao: formData.descricao || null,
        data_inicio: new Date(formData.data_inicio).toISOString(),
        data_fim: formData.data_fim ? new Date(formData.data_fim).toISOString() : null,
        local: formData.local || null,
        tipo: formData.tipo,
        prioridade: formData.prioridade as CompromissoInsert['prioridade'],
      };

      if (editingCompromisso) {
        atualizarCompromisso.mutate(
          { id: editingCompromisso.id, data: payload },
          {
            onSuccess: () => {
              toast.success('Compromisso atualizado!');
              handleCloseModal();
            },
            onError: () => {
              toast.error('Erro ao atualizar compromisso');
            },
          },
        );
      } else {
        criarCompromisso.mutate(payload, {
          onSuccess: () => {
            toast.success('Compromisso criado com sucesso!');
            handleCloseModal();
          },
          onError: () => {
            toast.error('Erro ao criar compromisso');
          },
        });
      }
    },
    [formData, editingCompromisso, criarCompromisso, atualizarCompromisso, toast, handleCloseModal],
  );

  // Delete
  const handleDelete = useCallback(() => {
    if (!deletingCompromisso) return;
    excluirCompromisso.mutate(deletingCompromisso.id, {
      onSuccess: () => {
        toast.success('Compromisso excluido');
        setDeletingCompromisso(null);
      },
      onError: () => {
        toast.error('Erro ao excluir compromisso');
      },
    });
  }, [excluirCompromisso, deletingCompromisso, toast]);

  // Toggle concluido
  const handleToggleConcluido = useCallback(
    (compromisso: Compromisso) => {
      marcarConcluido.mutate(
        { id: compromisso.id, concluido: !compromisso.concluido },
        {
          onSuccess: () => {
            toast.success(
              compromisso.concluido ? 'Compromisso reaberto' : 'Compromisso concluido!',
            );
          },
          onError: () => {
            toast.error('Erro ao atualizar compromisso');
          },
        },
      );
    },
    [marcarConcluido, toast],
  );

  // Update form field
  const updateField = useCallback(
    (field: keyof CompromissoFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded bg-card2" />
          <div className="h-10 w-44 animate-pulse rounded-lg bg-card2" />
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className="h-8 w-8 animate-pulse rounded bg-card2" />
          <div className="h-6 w-48 animate-pulse rounded bg-card2" />
          <div className="h-8 w-8 animate-pulse rounded bg-card2" />
        </div>
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Agenda</h1>
        <Button onClick={handleOpenAdd}>
          <Plus size={16} />
          Novo Compromisso
        </Button>
      </div>

      {/* Agente IA */}
      <AgentBannerAuto />

      {/* Date navigation */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={goToPrevDay}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
          aria-label="Dia anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={goToToday}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            isToday
              ? 'bg-accent/[0.14] text-accent'
              : 'text-muted hover:bg-card2 hover:text-text',
          )}
        >
          <Calendar size={16} />
          <span className="capitalize">{formattedDate}</span>
        </button>

        <button
          onClick={goToNextDay}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
          aria-label="Proximo dia"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Compromissos list */}
      {!compromissos || compromissos.length === 0 ? (
        <EmptyState
          icon={<Calendar size={48} />}
          title="Nenhum compromisso"
          description="Nao ha compromissos para este dia. Adicione um novo compromisso."
          actionLabel="Novo Compromisso"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="space-y-4">
          {Array.from(groupedCompromissos.entries()).map(([hour, items]) => (
            <div key={hour} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted">
                <Clock size={14} />
                <span>{hour}</span>
              </div>

              <div className="space-y-2 pl-6">
                {items.map((compromisso) => (
                  <div
                    key={compromisso.id}
                    className={clsx(
                      'group rounded-card border border-border bg-card p-4 transition-all hover:border-accent/30',
                      compromisso.concluido && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {/* Concluido toggle */}
                        <button
                          onClick={() => handleToggleConcluido(compromisso)}
                          className={clsx(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                            compromisso.concluido
                              ? 'border-green bg-green/20 text-green'
                              : 'border-border hover:border-accent',
                          )}
                          aria-label={
                            compromisso.concluido ? 'Reabrir compromisso' : 'Concluir compromisso'
                          }
                        >
                          {compromisso.concluido && <Check size={12} />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3
                              className={clsx(
                                'font-medium text-text',
                                compromisso.concluido && 'line-through',
                              )}
                            >
                              {compromisso.titulo}
                            </h3>
                            <Badge color={PRIORIDADE_COLORS[compromisso.prioridade] || 'yellow'}>
                              {PRIORIDADE_LABELS[compromisso.prioridade] || compromisso.prioridade}
                            </Badge>
                          </div>

                          {compromisso.descricao && (
                            <p className="mt-1 text-sm text-muted">{compromisso.descricao}</p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                            {compromisso.data_fim && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                ate {format(parseISO(compromisso.data_fim), 'HH:mm')}
                              </span>
                            )}
                            {compromisso.local && (
                              <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                {compromisso.local}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => handleOpenEdit(compromisso)}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card2 hover:text-text"
                          aria-label="Editar compromisso"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingCompromisso(compromisso)}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red/10 hover:text-red"
                          aria-label="Excluir compromisso"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingCompromisso ? 'Editar Compromisso' : 'Novo Compromisso'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Titulo"
            value={formData.titulo}
            onChange={(e) => updateField('titulo', e.target.value)}
            placeholder="Ex: Reuniao com equipe"
            required
          />

          <Textarea
            label="Descricao"
            value={formData.descricao}
            onChange={(e) => updateField('descricao', e.target.value)}
            placeholder="Detalhes do compromisso..."
            rows={3}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Inicio"
              type="datetime-local"
              value={formData.data_inicio}
              onChange={(e) => updateField('data_inicio', e.target.value)}
              required
            />
            <Input
              label="Fim"
              type="datetime-local"
              value={formData.data_fim}
              onChange={(e) => updateField('data_fim', e.target.value)}
            />
          </div>

          <Input
            label="Local"
            value={formData.local}
            onChange={(e) => updateField('local', e.target.value)}
            placeholder="Ex: Escritorio, Sala 3"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo"
              value={formData.tipo}
              onChange={(e) => updateField('tipo', e.target.value)}
              options={TIPO_OPTIONS}
            />
            <Select
              label="Prioridade"
              value={formData.prioridade}
              onChange={(e) => updateField('prioridade', e.target.value)}
              options={[
                { value: 'baixa', label: 'Baixa' },
                { value: 'media', label: 'Media' },
                { value: 'alta', label: 'Alta' },
                { value: 'urgente', label: 'Urgente' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" onClick={handleCloseModal} className="bg-card2 text-muted hover:text-text">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={criarCompromisso.isPending || atualizarCompromisso.isPending}
            >
              {criarCompromisso.isPending || atualizarCompromisso.isPending
                ? 'Salvando...'
                : editingCompromisso
                  ? 'Salvar'
                  : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingCompromisso}
        onClose={() => setDeletingCompromisso(null)}
        onConfirm={handleDelete}
        title="Excluir compromisso"
        message={`Tem certeza que deseja excluir "${deletingCompromisso?.titulo}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluirCompromisso.isPending}
      />
    </div>
  );
}
