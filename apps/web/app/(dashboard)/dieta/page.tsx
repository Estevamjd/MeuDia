'use client';

import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Utensils,
  Droplets,
  Scale,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { TipoRefeicao, ItemRefeicao, RefeicaoInsert } from '@meudia/shared';

import {
  useRefeicoesDoDia,
  useCriarRefeicao,
  useExcluirRefeicao,
  useAguaHoje,
  useRegistrarAgua,
  useHistoricoPeso,
  useRegistrarPeso,
  useResumoNutricional,
  useProfile,
} from '../../../hooks';

import {
  Button,
  StatCard,
  ProgressBar,
  Modal,
  Input,
  Select,
  EmptyState,
  SkeletonCard,
  ConfirmDialog,
  useToast,
} from '../../../components/ui';

const TIPOS_REFEICAO: { value: TipoRefeicao; label: string; emoji: string }[] = [
  { value: 'cafe', label: 'Cafe da manha', emoji: '☕' },
  { value: 'lanche_manha', label: 'Lanche da manha', emoji: '🍎' },
  { value: 'almoco', label: 'Almoco', emoji: '🍽️' },
  { value: 'lanche_tarde', label: 'Lanche da tarde', emoji: '🥪' },
  { value: 'jantar', label: 'Jantar', emoji: '🍲' },
  { value: 'ceia', label: 'Ceia', emoji: '🌙' },
];

function tipoLabel(tipo: TipoRefeicao) {
  return TIPOS_REFEICAO.find((t) => t.value === tipo)?.label ?? tipo;
}

function tipoEmoji(tipo: TipoRefeicao) {
  return TIPOS_REFEICAO.find((t) => t.value === tipo)?.emoji ?? '🍽️';
}

export default function DietaPage() {
  const toast = useToast();
  const { data: profile } = useProfile();

  // Date navigation
  const [dateOffset, setDateOffset] = useState(0);
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return d;
  }, [dateOffset]);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const isToday = dateOffset === 0;

  // Data hooks
  const { data: refeicoes, isLoading: loadingRefeicoes } = useRefeicoesDoDia(dateStr);
  const { data: agua, isLoading: loadingAgua } = useAguaHoje(dateStr);
  const { data: resumo, isLoading: loadingResumo } = useResumoNutricional(dateStr);
  const { data: historicoPeso } = useHistoricoPeso();

  // Mutations
  const criarRefeicao = useCriarRefeicao();
  const excluirRefeicao = useExcluirRefeicao();
  const registrarAgua = useRegistrarAgua();
  const registrarPeso = useRegistrarPeso();

  // Modal states
  const [showAddRefeicao, setShowAddRefeicao] = useState(false);
  const [showAddPeso, setShowAddPeso] = useState(false);
  const [deletingRefeicao, setDeletingRefeicao] = useState<string | null>(null);

  // Add meal form state
  const [mealType, setMealType] = useState<TipoRefeicao>('almoco');
  const [mealItems, setMealItems] = useState<ItemRefeicao[]>([
    { nome: '', calorias: 0, proteina: 0, carbo: 0, gordura: 0 },
  ]);

  // Add weight form state
  const [pesoValue, setPesoValue] = useState('');

  const metaCalorias = profile?.meta_calorias ?? 2200;
  const coposBebidos = agua?.copos_bebidos ?? 0;
  const metaCopos = agua?.meta_copos ?? 8;
  const caloriasConsumidas = resumo?.calorias ?? 0;
  const percentualCalorias = metaCalorias > 0 ? Math.min(Math.round((caloriasConsumidas / metaCalorias) * 100), 100) : 0;
  const percentualAgua = metaCopos > 0 ? Math.min(Math.round((coposBebidos / metaCopos) * 100), 100) : 0;
  const ultimoPeso = historicoPeso?.[0]?.peso ?? profile?.peso_atual ?? null;

  const isLoading = loadingRefeicoes || loadingAgua || loadingResumo;

  // Handlers
  const handleAddAgua = useCallback(() => {
    registrarAgua.mutate(dateStr, {
      onSuccess: () => toast.success('Agua registrada!'),
      onError: () => toast.error('Erro ao registrar agua'),
    });
  }, [registrarAgua, dateStr, toast]);

  const handleAddItem = () => {
    setMealItems((prev) => [
      ...prev,
      { nome: '', calorias: 0, proteina: 0, carbo: 0, gordura: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setMealItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemRefeicao, value: string | number) => {
    setMealItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleSubmitRefeicao = useCallback(() => {
    const validItems = mealItems.filter((i) => i.nome.trim() !== '');
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    const totalCalorias = validItems.reduce((acc, i) => acc + (i.calorias ?? 0), 0);
    const totalProteina = validItems.reduce((acc, i) => acc + (i.proteina ?? 0), 0);
    const totalCarbo = validItems.reduce((acc, i) => acc + (i.carbo ?? 0), 0);
    const totalGordura = validItems.reduce((acc, i) => acc + (i.gordura ?? 0), 0);

    const data: RefeicaoInsert = {
      tipo: mealType,
      data: dateStr,
      items: validItems,
      total_calorias: totalCalorias,
      total_proteina: totalProteina,
      total_carbo: totalCarbo,
      total_gordura: totalGordura,
    };

    criarRefeicao.mutate(data, {
      onSuccess: () => {
        toast.success('Refeicao adicionada!');
        setShowAddRefeicao(false);
        setMealItems([{ nome: '', calorias: 0, proteina: 0, carbo: 0, gordura: 0 }]);
      },
      onError: () => toast.error('Erro ao adicionar refeicao'),
    });
  }, [mealItems, mealType, dateStr, criarRefeicao, toast]);

  const handleSubmitPeso = useCallback(() => {
    const peso = parseFloat(pesoValue);
    if (isNaN(peso) || peso <= 0) {
      toast.error('Peso invalido');
      return;
    }
    registrarPeso.mutate(
      { peso, data: dateStr },
      {
        onSuccess: () => {
          toast.success('Peso registrado!');
          setShowAddPeso(false);
          setPesoValue('');
        },
        onError: () => toast.error('Erro ao registrar peso'),
      },
    );
  }, [pesoValue, dateStr, registrarPeso, toast]);

  const handleDeleteRefeicao = useCallback(() => {
    if (!deletingRefeicao) return;
    excluirRefeicao.mutate(deletingRefeicao, {
      onSuccess: () => {
        toast.success('Refeicao removida');
        setDeletingRefeicao(null);
      },
      onError: () => toast.error('Erro ao remover refeicao'),
    });
  }, [deletingRefeicao, excluirRefeicao, toast]);

  if (isLoading) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <SkeletonCard />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Dieta</h1>
        <Button onClick={() => setShowAddRefeicao(true)}>
          <Plus size={16} />
          Nova Refeicao
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setDateOffset((d) => d - 1)}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card hover:text-text"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-medium text-text">
          {isToday ? 'Hoje' : format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
        </span>
        <button
          onClick={() => setDateOffset((d) => Math.min(d + 1, 0))}
          className={clsx(
            'rounded-lg p-2 transition-colors',
            isToday ? 'text-card2 cursor-default' : 'text-muted hover:bg-card hover:text-text',
          )}
          disabled={isToday}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Calorias"
          value={`${caloriasConsumidas} / ${metaCalorias}`}
          icon={<Utensils size={16} />}
          tag={{
            text: `${percentualCalorias}%`,
            color: percentualCalorias > 100 ? 'red' : percentualCalorias >= 80 ? 'green' : 'yellow',
          }}
        />
        <div
          className="rounded-card border border-border bg-card p-5 cursor-pointer transition-all hover:border-accent/30"
          onClick={handleAddAgua}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Droplets size={16} /> Agua
          </div>
          <div className="mt-2 font-syne text-2xl font-bold text-accent3">
            {coposBebidos} / {metaCopos}
          </div>
          <ProgressBar
            value={coposBebidos}
            max={metaCopos}
            showValue={false}
            color={percentualAgua >= 100 ? 'green' : 'accent3'}
          />
          <p className="mt-1 text-[10px] text-muted">Clique para adicionar um copo</p>
        </div>
        <div
          className="rounded-card border border-border bg-card p-5 cursor-pointer transition-all hover:border-accent/30"
          onClick={() => setShowAddPeso(true)}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Scale size={16} /> Peso
          </div>
          <div className="mt-2 font-syne text-2xl font-bold text-accent2">
            {ultimoPeso ? `${ultimoPeso} kg` : '--'}
          </div>
          <p className="mt-1 text-[10px] text-muted">Clique para registrar peso</p>
        </div>
      </div>

      {/* Macros summary */}
      {resumo && caloriasConsumidas > 0 && (
        <div className="rounded-card border border-border bg-card p-5">
          <h2 className="mb-3 font-syne text-sm font-semibold text-text">Macros do dia</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green">{Math.round(resumo.proteina)}g</div>
              <div className="text-[10px] text-muted">Proteina</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange">{Math.round(resumo.carbo)}g</div>
              <div className="text-[10px] text-muted">Carboidratos</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow">{Math.round(resumo.gordura)}g</div>
              <div className="text-[10px] text-muted">Gordura</div>
            </div>
          </div>
        </div>
      )}

      {/* Meals list */}
      <div className="space-y-3">
        <h2 className="font-syne text-lg font-semibold text-text">
          Refeicoes ({refeicoes?.length ?? 0})
        </h2>

        {(!refeicoes || refeicoes.length === 0) ? (
          <EmptyState
            icon={<Utensils size={48} />}
            title="Nenhuma refeicao registrada"
            description="Adicione suas refeicoes para acompanhar calorias e macros."
            actionLabel="Adicionar refeicao"
            onAction={() => setShowAddRefeicao(true)}
          />
        ) : (
          <div className="space-y-3">
            {refeicoes.map((ref) => (
              <div
                key={ref.id}
                className="rounded-card border border-border bg-card p-4 transition-all hover:border-accent/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{tipoEmoji(ref.tipo)}</span>
                    <div>
                      <h3 className="text-sm font-medium text-text">{tipoLabel(ref.tipo)}</h3>
                      <p className="text-xs text-muted">
                        {ref.total_calorias} kcal
                        {ref.total_proteina > 0 && ` | P: ${ref.total_proteina}g`}
                        {ref.total_carbo > 0 && ` | C: ${ref.total_carbo}g`}
                        {ref.total_gordura > 0 && ` | G: ${ref.total_gordura}g`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeletingRefeicao(ref.id)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-red/10 hover:text-red"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {ref.items && ref.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ref.items.map((item, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-card2 px-2 py-0.5 text-[10px] text-muted"
                      >
                        {item.nome} ({item.calorias} kcal)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Meal Modal */}
      <Modal
        isOpen={showAddRefeicao}
        onClose={() => setShowAddRefeicao(false)}
        title="Nova Refeicao"
      >
        <div className="space-y-4">
          <Select
            label="Tipo de refeicao"
            value={mealType}
            onChange={(e) => setMealType(e.target.value as TipoRefeicao)}
            options={TIPOS_REFEICAO.map((t) => ({
              value: t.value,
              label: `${t.emoji} ${t.label}`,
            }))}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text">Itens</span>
              <button
                onClick={handleAddItem}
                className="text-xs text-accent transition-colors hover:text-accent2"
              >
                + Adicionar item
              </button>
            </div>

            {mealItems.map((item, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-border bg-card2 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    label=""
                    placeholder="Nome do alimento"
                    value={item.nome}
                    onChange={(e) => handleItemChange(index, 'nome', e.target.value)}
                  />
                  {mealItems.length > 1 && (
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="mt-1 rounded-lg p-2 text-muted transition-colors hover:text-red"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Input
                    label="Calorias"
                    type="number"
                    value={String(item.calorias || '')}
                    onChange={(e) => handleItemChange(index, 'calorias', Number(e.target.value))}
                  />
                  <Input
                    label="Proteina (g)"
                    type="number"
                    value={String(item.proteina || '')}
                    onChange={(e) => handleItemChange(index, 'proteina', Number(e.target.value))}
                  />
                  <Input
                    label="Carbo (g)"
                    type="number"
                    value={String(item.carbo || '')}
                    onChange={(e) => handleItemChange(index, 'carbo', Number(e.target.value))}
                  />
                  <Input
                    label="Gordura (g)"
                    type="number"
                    value={String(item.gordura || '')}
                    onChange={(e) => handleItemChange(index, 'gordura', Number(e.target.value))}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={handleSubmitRefeicao}
            isLoading={criarRefeicao.isPending}
            className="w-full"
          >
            Adicionar Refeicao
          </Button>
        </div>
      </Modal>

      {/* Add Weight Modal */}
      <Modal
        isOpen={showAddPeso}
        onClose={() => setShowAddPeso(false)}
        title="Registrar Peso"
      >
        <div className="space-y-4">
          <Input
            label="Peso (kg)"
            type="number"
            step="0.1"
            placeholder="Ex: 78.5"
            value={pesoValue}
            onChange={(e) => setPesoValue(e.target.value)}
            icon={<Scale size={16} />}
          />
          <Button
            onClick={handleSubmitPeso}
            isLoading={registrarPeso.isPending}
            className="w-full"
          >
            Registrar
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingRefeicao}
        onClose={() => setDeletingRefeicao(null)}
        onConfirm={handleDeleteRefeicao}
        title="Remover refeicao"
        message="Tem certeza que deseja remover esta refeicao?"
        confirmLabel="Remover"
        isLoading={excluirRefeicao.isPending}
      />
    </div>
  );
}
