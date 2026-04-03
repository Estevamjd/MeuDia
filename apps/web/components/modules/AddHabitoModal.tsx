'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { habitoInsertSchema } from '@meudia/api';
import type { HabitoInsert, DiaSemana } from '@meudia/shared';
import { DIAS_SEMANA_CURTO } from '@meudia/shared';
import { clsx } from 'clsx';

import { Modal, Input, Select, Button } from '../ui';

interface AddHabitoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: HabitoInsert) => void;
  defaultValues?: Partial<HabitoInsert>;
  isLoading?: boolean;
}

const EMOJI_SUGESTOES = ['✅', '💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '🎯', '💪', '🧠', '🫁'];

const FREQUENCIA_OPTIONS = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
];

export function AddHabitoModal({
  isOpen,
  onClose,
  onSubmit,
  defaultValues,
  isLoading = false,
}: AddHabitoModalProps) {
  const isEditing = !!defaultValues?.nome;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<HabitoInsert>({
    resolver: zodResolver(habitoInsertSchema),
    defaultValues: {
      nome: '',
      icone: '✅',
      frequencia: 'diario',
      dias_semana: [0, 1, 2, 3, 4, 5, 6],
      meta: 1,
      ...defaultValues,
    },
  });

  const iconeAtual = watch('icone');

  useEffect(() => {
    if (isOpen) {
      reset({
        nome: '',
        icone: '✅',
        frequencia: 'diario',
        dias_semana: [0, 1, 2, 3, 4, 5, 6],
        meta: 1,
        ...defaultValues,
      });
    }
  }, [isOpen, defaultValues, reset]);

  function handleFormSubmit(data: HabitoInsert) {
    onSubmit(data);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Hábito' : 'Novo Hábito'}
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Nome */}
        <Input
          label="Nome do hábito"
          placeholder="Ex: Beber 8 copos de água"
          autoFocus
          error={errors.nome?.message}
          {...register('nome')}
        />

        {/* Ícone */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted">Ícone</label>
          <div className="flex flex-wrap gap-2">
            <Controller
              name="icone"
              control={control}
              render={({ field }) => (
                <>
                  {EMOJI_SUGESTOES.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => field.onChange(emoji)}
                      className={clsx(
                        'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all',
                        field.value === emoji
                          ? 'border-accent bg-accent/20 scale-110'
                          : 'border-border bg-card2 hover:border-accent/50',
                      )}
                      aria-label={`Selecionar ícone ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </>
              )}
            />
          </div>
          <Input
            placeholder="Ou digite um emoji personalizado"
            className="mt-1"
            value={iconeAtual}
            onChange={(e) => {
              const val = e.target.value;
              // Get the last character/emoji entered
              if (val.length > 0) {
                const segments = [...new Intl.Segmenter().segment(val)];
                const lastEmoji = segments[segments.length - 1]?.segment ?? val;
                reset((prev) => ({ ...prev, icone: lastEmoji }));
              }
            }}
          />
        </div>

        {/* Frequência */}
        <Select
          label="Frequência"
          options={FREQUENCIA_OPTIONS}
          error={errors.frequencia?.message}
          {...register('frequencia')}
        />

        {/* Meta */}
        <Input
          label="Meta diária"
          type="number"
          min={1}
          max={100}
          placeholder="1"
          error={errors.meta?.message}
          {...register('meta', { valueAsNumber: true })}
        />

        {/* Dias da semana */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted">Dias da semana</label>
          <Controller
            name="dias_semana"
            control={control}
            render={({ field }) => (
              <div className="flex gap-2">
                {DIAS_SEMANA_CURTO.map((dia, index) => {
                  const selected = (field.value ?? []).includes(index as DiaSemana);
                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => {
                        const current = field.value ?? [];
                        if (selected) {
                          field.onChange(current.filter((d: number) => d !== index));
                        } else {
                          field.onChange([...current, index as DiaSemana]);
                        }
                      }}
                      className={clsx(
                        'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all',
                        selected
                          ? 'bg-accent text-white'
                          : 'border border-border bg-card2 text-muted hover:border-accent/50',
                      )}
                      aria-label={`${dia} ${selected ? 'selecionado' : 'não selecionado'}`}
                      aria-pressed={selected}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing ? 'Salvar' : 'Criar Hábito'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
