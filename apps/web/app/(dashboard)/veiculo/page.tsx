'use client';

import { useState, useMemo, useCallback } from 'react';
import { Car, Plus, Wrench, Gauge, AlertTriangle, Calendar } from 'lucide-react';
import type { Veiculo, Manutencao } from '@meudia/shared';

import {
  useVeiculos,
  useCriarVeiculo,
  useAtualizarVeiculo,
  useExcluirVeiculo,
  useManutencoes,
  useCriarManutencao,
  useExcluirManutencao,
} from '../../../hooks';

import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatCard } from '../../../components/ui/StatCard';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { useToast } from '../../../components/ui/Toast';
import { AgentBannerAuto } from '../../../components/agent';

// --- Helpers ---

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatKm = (km: number) =>
  new Intl.NumberFormat('pt-BR').format(km);

const TIPOS_MANUTENCAO = [
  { value: 'Oleo', label: 'Oleo' },
  { value: 'Pneus', label: 'Pneus' },
  { value: 'Freios', label: 'Freios' },
  { value: 'Filtros', label: 'Filtros' },
  { value: 'Revisao Geral', label: 'Revisao Geral' },
  { value: 'Alinhamento', label: 'Alinhamento' },
  { value: 'Balanceamento', label: 'Balanceamento' },
  { value: 'Outros', label: 'Outros' },
];

// --- Component ---

export default function VeiculoPage() {
  const toast = useToast();

  // --- Data hooks ---
  const { data: veiculos, isLoading: loadingVeiculos } = useVeiculos();
  const criarVeiculo = useCriarVeiculo();
  const atualizarVeiculo = useAtualizarVeiculo();
  const excluirVeiculo = useExcluirVeiculo();
  const criarManutencao = useCriarManutencao();
  const excluirManutencaoMut = useExcluirManutencao();

  // --- State ---
  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null);
  const [showVeiculoModal, setShowVeiculoModal] = useState(false);
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null);
  const [deletingVeiculo, setDeletingVeiculo] = useState<Veiculo | null>(null);
  const [showManutencaoModal, setShowManutencaoModal] = useState(false);
  const [deletingManutencao, setDeletingManutencao] = useState<Manutencao | null>(null);

  // Vehicle form state
  const [veiculoForm, setVeiculoForm] = useState({ modelo: '', placa: '', ano: '', km_atual: '' });

  // Maintenance form state
  const [manutencaoForm, setManutencaoForm] = useState({
    tipo: 'Oleo',
    data: '',
    km_na_revisao: '',
    custo: '',
    proxima_revisao_km: '',
    observacao: '',
  });

  // Manutencoes for selected vehicle
  const { data: manutencoes, isLoading: loadingManutencoes } = useManutencoes(
    selectedVeiculo?.id,
  );

  // --- Derived data ---

  // Stats for selected vehicle
  const totalGastos = useMemo(() => {
    if (!manutencoes) return 0;
    return manutencoes.reduce((acc, m) => acc + (m.custo ? Number(m.custo) : 0), 0);
  }, [manutencoes]);

  const ultimaRevisao = useMemo(() => {
    if (!manutencoes || manutencoes.length === 0) return null;
    return manutencoes[0]; // already ordered by data desc
  }, [manutencoes]);

  const proximaRevisaoKm = useMemo(() => {
    if (!manutencoes) return null;
    for (const m of manutencoes) {
      if (m.proxima_revisao_km) return m.proxima_revisao_km;
    }
    return null;
  }, [manutencoes]);

  // Alerts for selected vehicle
  const veiculoAlertas = useMemo(() => {
    if (!selectedVeiculo || !manutencoes) return [];
    const result: { tipo: string; kmRestantes: number; proximaKm: number }[] = [];
    for (const m of manutencoes) {
      if (m.proxima_revisao_km && selectedVeiculo.km_atual) {
        const kmRestantes = m.proxima_revisao_km - selectedVeiculo.km_atual;
        if (kmRestantes > 0 && kmRestantes <= 1000) {
          result.push({ tipo: m.tipo, kmRestantes, proximaKm: m.proxima_revisao_km });
        }
      }
    }
    return result;
  }, [selectedVeiculo, manutencoes]);

  // --- Actions ---

  const resetVeiculoForm = useCallback(() => {
    setVeiculoForm({ modelo: '', placa: '', ano: '', km_atual: '' });
  }, []);

  const resetManutencaoForm = useCallback(() => {
    setManutencaoForm({
      tipo: 'Oleo',
      data: '',
      km_na_revisao: '',
      custo: '',
      proxima_revisao_km: '',
      observacao: '',
    });
  }, []);

  const handleOpenAddVeiculo = useCallback(() => {
    resetVeiculoForm();
    setEditingVeiculo(null);
    setShowVeiculoModal(true);
  }, [resetVeiculoForm]);

  const handleOpenEditVeiculo = useCallback((v: Veiculo) => {
    setVeiculoForm({
      modelo: v.modelo,
      placa: v.placa ?? '',
      ano: v.ano?.toString() ?? '',
      km_atual: v.km_atual?.toString() ?? '0',
    });
    setEditingVeiculo(v);
    setShowVeiculoModal(true);
  }, []);

  const handleSaveVeiculo = useCallback(async () => {
    const payload = {
      modelo: veiculoForm.modelo,
      placa: veiculoForm.placa || undefined,
      ano: veiculoForm.ano ? Number(veiculoForm.ano) : undefined,
      km_atual: veiculoForm.km_atual ? Number(veiculoForm.km_atual) : 0,
    };

    try {
      if (editingVeiculo) {
        await atualizarVeiculo.mutateAsync({ id: editingVeiculo.id, data: payload });
        toast.success('Veiculo atualizado!');
      } else {
        await criarVeiculo.mutateAsync(payload);
        toast.success('Veiculo adicionado!');
      }
      setShowVeiculoModal(false);
      resetVeiculoForm();
      setEditingVeiculo(null);
    } catch {
      toast.error('Erro ao salvar veiculo.');
    }
  }, [veiculoForm, editingVeiculo, atualizarVeiculo, criarVeiculo, toast, resetVeiculoForm]);

  const handleDeleteVeiculo = useCallback(async () => {
    if (!deletingVeiculo) return;
    try {
      await excluirVeiculo.mutateAsync(deletingVeiculo.id);
      if (selectedVeiculo?.id === deletingVeiculo.id) {
        setSelectedVeiculo(null);
      }
      setDeletingVeiculo(null);
      toast.success('Veiculo excluido.');
    } catch {
      toast.error('Erro ao excluir veiculo.');
    }
  }, [deletingVeiculo, excluirVeiculo, selectedVeiculo, toast]);

  const handleAddManutencao = useCallback(async () => {
    if (!selectedVeiculo) return;
    const payload = {
      veiculo_id: selectedVeiculo.id,
      tipo: manutencaoForm.tipo,
      data: manutencaoForm.data,
      km_na_revisao: manutencaoForm.km_na_revisao ? Number(manutencaoForm.km_na_revisao) : undefined,
      custo: manutencaoForm.custo ? Number(manutencaoForm.custo) : undefined,
      proxima_revisao_km: manutencaoForm.proxima_revisao_km ? Number(manutencaoForm.proxima_revisao_km) : undefined,
      observacao: manutencaoForm.observacao || undefined,
    };

    try {
      await criarManutencao.mutateAsync(payload);
      setShowManutencaoModal(false);
      resetManutencaoForm();
      toast.success('Manutencao registrada!');
    } catch {
      toast.error('Erro ao registrar manutencao.');
    }
  }, [selectedVeiculo, manutencaoForm, criarManutencao, toast, resetManutencaoForm]);

  const handleDeleteManutencao = useCallback(async () => {
    if (!deletingManutencao || !selectedVeiculo) return;
    try {
      await excluirManutencaoMut.mutateAsync({
        id: deletingManutencao.id,
        veiculoId: selectedVeiculo.id,
      });
      setDeletingManutencao(null);
      toast.success('Manutencao excluida.');
    } catch {
      toast.error('Erro ao excluir manutencao.');
    }
  }, [deletingManutencao, selectedVeiculo, excluirManutencaoMut, toast]);

  // -------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------

  return (
    <div className="animate-fadeSlide flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Veiculo</h1>
        <Button onClick={handleOpenAddVeiculo}>
          <Plus size={16} />
          Novo Veiculo
        </Button>
      </div>

      {/* Agente IA */}
      <AgentBannerAuto />

      {/* Vehicle list */}
      {loadingVeiculos ? (
        <SkeletonList count={3} />
      ) : !veiculos || veiculos.length === 0 ? (
        <EmptyState
          icon={<Car size={40} />}
          title="Nenhum veiculo cadastrado"
          description="Adicione seu primeiro veiculo para acompanhar manutencoes e quilometragem."
          actionLabel="Adicionar Veiculo"
          onAction={handleOpenAddVeiculo}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {veiculos.map((veiculo) => (
            <Card
              key={veiculo.id}
              className={`cursor-pointer transition-all duration-200 hover:border-accent/50 ${
                selectedVeiculo?.id === veiculo.id ? 'border-accent ring-1 ring-accent/30' : ''
              }`}
              onClick={() => setSelectedVeiculo(veiculo)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
                    <Car size={20} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-syne font-bold text-text">{veiculo.modelo}</p>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      {veiculo.placa && <span>{veiculo.placa}</span>}
                      {veiculo.ano && <span>{veiculo.ano}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditVeiculo(veiculo);
                    }}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card2 hover:text-text"
                    aria-label="Editar veiculo"
                  >
                    <Wrench size={14} />
                  </button>
                </div>
              </div>

              {/* Odometer display */}
              <div className="mt-4 flex items-center gap-2">
                <Gauge size={16} className="text-muted" />
                <div className="flex items-baseline gap-1">
                  <span className="font-syne text-xl font-bold text-text">
                    {formatKm(veiculo.km_atual)}
                  </span>
                  <span className="text-xs text-muted">km</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Selected vehicle detail */}
      {selectedVeiculo && (
        <>
          {/* Maintenance alerts */}
          {veiculoAlertas.length > 0 && (
            <div className="flex flex-col gap-2">
              {veiculoAlertas.map((alerta, i) => (
                <Card key={i} variant="orange" className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange/20">
                    <AlertTriangle size={16} className="text-orange" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">
                      {alerta.tipo} - Revisao em {formatKm(alerta.kmRestantes)} km
                    </p>
                    <p className="text-xs text-muted">
                      Proxima revisao: {formatKm(alerta.proximaKm)} km
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total gastos"
              value={formatBRL(totalGastos)}
              icon={<Wrench size={16} />}
            />
            <StatCard
              label="Ultima revisao"
              value={ultimaRevisao ? ultimaRevisao.tipo : '-'}
              icon={<Calendar size={16} />}
              tag={
                ultimaRevisao
                  ? { text: ultimaRevisao.data, color: 'purple' as const }
                  : undefined
              }
            />
            <StatCard
              label="Proxima revisao"
              value={proximaRevisaoKm ? `${formatKm(proximaRevisaoKm)} km` : '-'}
              icon={<Gauge size={16} />}
            />
          </div>

          {/* Maintenance header */}
          <div className="flex items-center justify-between">
            <h2 className="font-syne text-xl font-bold text-text">
              Manutencoes - {selectedVeiculo.modelo}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeletingVeiculo(selectedVeiculo)}
              >
                Excluir Veiculo
              </Button>
              <Button
                onClick={() => {
                  resetManutencaoForm();
                  setShowManutencaoModal(true);
                }}
              >
                <Plus size={16} />
                Nova Manutencao
              </Button>
            </div>
          </div>

          {/* Maintenance list */}
          {loadingManutencoes ? (
            <SkeletonList count={3} />
          ) : !manutencoes || manutencoes.length === 0 ? (
            <EmptyState
              icon={<Wrench size={40} />}
              title="Nenhuma manutencao registrada"
              description="Registre as manutencoes para acompanhar o historico do veiculo."
              actionLabel="Registrar Manutencao"
              onAction={() => {
                resetManutencaoForm();
                setShowManutencaoModal(true);
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {manutencoes.map((m) => (
                <Card key={m.id} className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple/20">
                      <Wrench size={16} className="text-purple" />
                    </div>
                    <div>
                      <p className="font-medium text-text">{m.tipo}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {m.data}
                        </span>
                        {m.km_na_revisao && (
                          <span className="flex items-center gap-1">
                            <Gauge size={12} />
                            {formatKm(m.km_na_revisao)} km
                          </span>
                        )}
                        {m.custo && (
                          <span className="font-medium text-green">
                            {formatBRL(Number(m.custo))}
                          </span>
                        )}
                      </div>
                      {m.proxima_revisao_km && (
                        <p className="mt-1 text-xs text-muted">
                          Proxima revisao: {formatKm(m.proxima_revisao_km)} km
                        </p>
                      )}
                      {m.observacao && (
                        <p className="mt-1 text-xs text-muted italic">{m.observacao}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeletingManutencao(m)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card2 hover:text-red"
                    aria-label="Excluir manutencao"
                  >
                    <span className="text-xs">Excluir</span>
                  </button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Vehicle Modal */}
      <Modal
        isOpen={showVeiculoModal}
        onClose={() => {
          setShowVeiculoModal(false);
          setEditingVeiculo(null);
        }}
        title={editingVeiculo ? 'Editar Veiculo' : 'Novo Veiculo'}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Modelo"
            placeholder="Ex: Honda Civic 2020"
            value={veiculoForm.modelo}
            onChange={(e) => setVeiculoForm((f) => ({ ...f, modelo: e.target.value }))}
          />
          <Input
            label="Placa"
            placeholder="Ex: ABC-1234"
            value={veiculoForm.placa}
            onChange={(e) => setVeiculoForm((f) => ({ ...f, placa: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ano"
              type="number"
              placeholder="Ex: 2020"
              value={veiculoForm.ano}
              onChange={(e) => setVeiculoForm((f) => ({ ...f, ano: e.target.value }))}
            />
            <Input
              label="Km atual"
              type="number"
              placeholder="Ex: 45000"
              value={veiculoForm.km_atual}
              onChange={(e) => setVeiculoForm((f) => ({ ...f, km_atual: e.target.value }))}
            />
          </div>
          <Button
            className="mt-2 w-full"
            onClick={handleSaveVeiculo}
            isLoading={criarVeiculo.isPending || atualizarVeiculo.isPending}
            disabled={!veiculoForm.modelo.trim()}
          >
            {editingVeiculo ? 'Salvar Alteracoes' : 'Adicionar Veiculo'}
          </Button>
        </div>
      </Modal>

      {/* Add Maintenance Modal */}
      <Modal
        isOpen={showManutencaoModal}
        onClose={() => setShowManutencaoModal(false)}
        title="Nova Manutencao"
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Tipo"
            options={TIPOS_MANUTENCAO}
            value={manutencaoForm.tipo}
            onChange={(e) => setManutencaoForm((f) => ({ ...f, tipo: e.target.value }))}
          />
          <Input
            label="Data"
            type="date"
            value={manutencaoForm.data}
            onChange={(e) => setManutencaoForm((f) => ({ ...f, data: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Km na revisao"
              type="number"
              placeholder="Ex: 45000"
              value={manutencaoForm.km_na_revisao}
              onChange={(e) =>
                setManutencaoForm((f) => ({ ...f, km_na_revisao: e.target.value }))
              }
            />
            <Input
              label="Custo (R$)"
              type="number"
              step="0.01"
              placeholder="Ex: 350.00"
              value={manutencaoForm.custo}
              onChange={(e) => setManutencaoForm((f) => ({ ...f, custo: e.target.value }))}
            />
          </div>
          <Input
            label="Proxima revisao (km)"
            type="number"
            placeholder="Ex: 55000"
            value={manutencaoForm.proxima_revisao_km}
            onChange={(e) =>
              setManutencaoForm((f) => ({ ...f, proxima_revisao_km: e.target.value }))
            }
          />
          <Textarea
            label="Observacao"
            placeholder="Detalhes adicionais..."
            value={manutencaoForm.observacao}
            onChange={(e) =>
              setManutencaoForm((f) => ({ ...f, observacao: e.target.value }))
            }
          />
          <Button
            className="mt-2 w-full"
            onClick={handleAddManutencao}
            isLoading={criarManutencao.isPending}
            disabled={!manutencaoForm.tipo || !manutencaoForm.data}
          >
            Registrar Manutencao
          </Button>
        </div>
      </Modal>

      {/* Delete vehicle confirmation */}
      <ConfirmDialog
        isOpen={!!deletingVeiculo}
        onClose={() => setDeletingVeiculo(null)}
        onConfirm={handleDeleteVeiculo}
        title="Excluir veiculo"
        message={`Tem certeza que deseja excluir "${deletingVeiculo?.modelo}"? Todas as manutencoes serao excluidas. Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluirVeiculo.isPending}
      />

      {/* Delete maintenance confirmation */}
      <ConfirmDialog
        isOpen={!!deletingManutencao}
        onClose={() => setDeletingManutencao(null)}
        onConfirm={handleDeleteManutencao}
        title="Excluir manutencao"
        message={`Tem certeza que deseja excluir a manutencao "${deletingManutencao?.tipo}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluirManutencaoMut.isPending}
      />
    </div>
  );
}
