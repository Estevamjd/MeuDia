'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Pill,
  Check,
  AlertTriangle,
  Trash2,
  Clock,
  Package,
} from 'lucide-react';

import {
  useMedicamentosHoje,
  useMedicamentos,
  useCriarMedicamento,
  useExcluirMedicamento,
  useRegistrarTomado,
  useEstoqueBaixo,
} from '../../../hooks';

import {
  Button,
  StatCard,
  Modal,
  Input,
  EmptyState,
  SkeletonCard,
  SkeletonList,
  ConfirmDialog,
  useToast,
} from '../../../components/ui';

export default function MedicamentosPage() {
  const toast = useToast();

  // Data hooks
  const { data: medicamentosHoje, isLoading: loadingHoje } = useMedicamentosHoje();
  const { data: medicamentos, isLoading: loadingMeds } = useMedicamentos();
  const { data: estoqueBaixo } = useEstoqueBaixo();

  // Mutations
  const criarMedicamento = useCriarMedicamento();
  const excluirMedicamento = useExcluirMedicamento();
  const registrarTomado = useRegistrarTomado();

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingMed, setDeletingMed] = useState<string | null>(null);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formDosagem, setFormDosagem] = useState('');
  const [formFrequencia, setFormFrequencia] = useState('1x ao dia');
  const [formHorarios, setFormHorarios] = useState('08:00');
  const [formEstoque, setFormEstoque] = useState('30');
  const [formEstoqueMin, setFormEstoqueMin] = useState('5');

  const isLoading = loadingHoje || loadingMeds;

  const totalMeds = medicamentos?.length ?? 0;
  const tomadosHoje = medicamentosHoje?.filter((m) => m.tomadoHoje).length ?? 0;
  const pendentesHoje = (medicamentosHoje?.length ?? 0) - tomadosHoje;
  const alertasEstoque = estoqueBaixo?.length ?? 0;

  const resetForm = () => {
    setFormNome('');
    setFormDosagem('');
    setFormFrequencia('1x ao dia');
    setFormHorarios('08:00');
    setFormEstoque('30');
    setFormEstoqueMin('5');
  };

  const handleSubmit = useCallback(() => {
    if (!formNome.trim() || !formDosagem.trim()) {
      toast.error('Preencha nome e dosagem');
      return;
    }

    const horarios = formHorarios.split(',').map((h) => h.trim()).filter(Boolean);
    if (horarios.length === 0) {
      toast.error('Adicione pelo menos um horario');
      return;
    }

    criarMedicamento.mutate(
      {
        nome: formNome.trim(),
        dosagem: formDosagem.trim(),
        frequencia: formFrequencia,
        horarios,
        estoque_atual: parseInt(formEstoque) || 0,
        estoque_minimo: parseInt(formEstoqueMin) || 5,
      },
      {
        onSuccess: () => {
          toast.success('Medicamento adicionado!');
          setShowAddModal(false);
          resetForm();
        },
        onError: () => toast.error('Erro ao adicionar medicamento'),
      },
    );
  }, [formNome, formDosagem, formFrequencia, formHorarios, formEstoque, formEstoqueMin, criarMedicamento, toast]);

  const handleTomar = useCallback(
    (medId: string) => {
      registrarTomado.mutate(medId, {
        onSuccess: () => toast.success('Medicamento registrado!'),
        onError: () => toast.error('Erro ao registrar'),
      });
    },
    [registrarTomado, toast],
  );

  const handleDelete = useCallback(() => {
    if (!deletingMed) return;
    excluirMedicamento.mutate(deletingMed, {
      onSuccess: () => {
        toast.success('Medicamento removido');
        setDeletingMed(null);
      },
      onError: () => toast.error('Erro ao remover medicamento'),
    });
  }, [deletingMed, excluirMedicamento, toast]);

  if (isLoading) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <SkeletonCard />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Medicamentos</h1>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Novo Medicamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total cadastrados"
          value={totalMeds}
          icon={<Pill size={16} />}
          tag={{ text: 'ativos', color: 'purple' }}
        />
        <StatCard
          label="Tomados hoje"
          value={`${tomadosHoje} / ${medicamentosHoje?.length ?? 0}`}
          icon={<Check size={16} />}
          tag={{
            text: pendentesHoje === 0 ? 'Completo' : `${pendentesHoje} pendente(s)`,
            color: pendentesHoje === 0 ? 'green' : 'yellow',
          }}
        />
        <StatCard
          label="Alertas de estoque"
          value={alertasEstoque}
          icon={<AlertTriangle size={16} />}
          tag={{
            text: alertasEstoque === 0 ? 'OK' : 'Estoque baixo',
            color: alertasEstoque === 0 ? 'green' : 'red',
          }}
        />
      </div>

      {/* Low stock alerts */}
      {estoqueBaixo && estoqueBaixo.length > 0 && (
        <div className="rounded-card border border-yellow/30 bg-yellow/[0.06] p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-yellow">
            <AlertTriangle size={16} />
            Estoque baixo
          </h3>
          <div className="space-y-1">
            {estoqueBaixo.map((med) => (
              <p key={med.id} className="text-xs text-muted">
                <span className="text-text">{med.nome}</span> — {med.estoque_atual} restantes
                (minimo: {med.estoque_minimo})
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Today's medications */}
      <div className="space-y-3">
        <h2 className="font-syne text-lg font-semibold text-text">
          Hoje ({medicamentosHoje?.length ?? 0})
        </h2>

        {(!medicamentosHoje || medicamentosHoje.length === 0) ? (
          <EmptyState
            icon={<Pill size={48} />}
            title="Nenhum medicamento cadastrado"
            description="Adicione seus medicamentos para controlar horarios e estoque."
            actionLabel="Adicionar medicamento"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <div className="space-y-3">
            {medicamentosHoje.map((med) => (
              <div
                key={med.id}
                className={`rounded-card border bg-card p-4 transition-all ${
                  med.tomadoHoje
                    ? 'border-green/30 opacity-70'
                    : 'border-border hover:border-accent/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        med.tomadoHoje
                          ? 'bg-green/[0.14] text-green'
                          : 'bg-accent/[0.14] text-accent'
                      }`}
                    >
                      {med.tomadoHoje ? <Check size={20} /> : <Pill size={20} />}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-text">{med.nome}</h3>
                      <p className="text-xs text-muted">
                        {med.dosagem} — {med.frequencia}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {Array.isArray(med.horarios)
                            ? med.horarios.join(', ')
                            : med.horarios}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package size={10} />
                          Estoque: {med.estoque_atual}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!med.tomadoHoje && (
                      <Button
                        variant="ghost"
                        onClick={() => handleTomar(med.id)}
                        isLoading={registrarTomado.isPending}
                      >
                        <Check size={14} />
                        Tomar
                      </Button>
                    )}
                    <button
                      onClick={() => setDeletingMed(med.id)}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-red/10 hover:text-red"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title="Novo Medicamento"
      >
        <div className="space-y-4">
          <Input
            label="Nome"
            placeholder="Ex: Vitamina D"
            value={formNome}
            onChange={(e) => setFormNome(e.target.value)}
            icon={<Pill size={16} />}
          />
          <Input
            label="Dosagem"
            placeholder="Ex: 5000 UI"
            value={formDosagem}
            onChange={(e) => setFormDosagem(e.target.value)}
          />
          <Input
            label="Frequencia"
            placeholder="Ex: 1x ao dia"
            value={formFrequencia}
            onChange={(e) => setFormFrequencia(e.target.value)}
          />
          <Input
            label="Horarios (separados por virgula)"
            placeholder="Ex: 08:00, 20:00"
            value={formHorarios}
            onChange={(e) => setFormHorarios(e.target.value)}
            icon={<Clock size={16} />}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Estoque atual"
              type="number"
              value={formEstoque}
              onChange={(e) => setFormEstoque(e.target.value)}
            />
            <Input
              label="Estoque minimo"
              type="number"
              value={formEstoqueMin}
              onChange={(e) => setFormEstoqueMin(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSubmit}
            isLoading={criarMedicamento.isPending}
            className="w-full"
          >
            Adicionar
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingMed}
        onClose={() => setDeletingMed(null)}
        onConfirm={handleDelete}
        title="Remover medicamento"
        message="Tem certeza que deseja remover este medicamento? Os registros de uso serao mantidos."
        confirmLabel="Remover"
        isLoading={excluirMedicamento.isPending}
      />
    </div>
  );
}
