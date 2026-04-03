'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

const formSchema = z.object({
  nome: z.string().min(1, 'Nome do exercicio e obrigatorio'),
  series: z.coerce.number().min(1, 'Minimo 1 serie').default(3),
  repeticoes: z.string().min(1, 'Repeticoes e obrigatorio').default('10-12'),
  carga: z.coerce.number().min(0).nullable().optional(),
  tempo_descanso: z.coerce.number().min(0, 'Valor invalido').default(60),
  observacao: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface ExercicioFormData {
  nome: string;
  series: number;
  repeticoes: string;
  carga?: number | null;
  tempo_descanso: number;
  observacao?: string | null;
}

interface AddExercicioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ExercicioFormData) => void;
  isLoading?: boolean;
  defaultValues?: Partial<ExercicioFormData>;
  title?: string;
}

export function AddExercicioModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  defaultValues,
  title = 'Adicionar Exercicio',
}: AddExercicioModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: defaultValues?.nome ?? '',
      series: defaultValues?.series ?? 3,
      repeticoes: defaultValues?.repeticoes ?? '10-12',
      carga: defaultValues?.carga ?? undefined,
      tempo_descanso: defaultValues?.tempo_descanso ?? 60,
      observacao: defaultValues?.observacao ?? '',
    },
  });

  const handleFormSubmit = (data: FormData) => {
    onSubmit({
      nome: data.nome,
      series: data.series,
      repeticoes: data.repeticoes,
      carga: data.carga ?? null,
      tempo_descanso: data.tempo_descanso,
      observacao: data.observacao || null,
    });
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nome do exercicio"
          placeholder="Ex: Supino reto"
          autoFocus
          error={errors.nome?.message}
          {...register('nome')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Series"
            type="number"
            min={1}
            error={errors.series?.message}
            {...register('series')}
          />
          <Input
            label="Repeticoes"
            placeholder="10-12"
            error={errors.repeticoes?.message}
            {...register('repeticoes')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Carga (kg)"
            type="number"
            step="0.5"
            min={0}
            placeholder="Opcional"
            error={errors.carga?.message}
            {...register('carga')}
          />
          <Input
            label="Descanso (seg)"
            type="number"
            min={0}
            error={errors.tempo_descanso?.message}
            {...register('tempo_descanso')}
          />
        </div>

        <Textarea
          label="Observacao"
          placeholder="Dicas, variacao, notas..."
          error={errors.observacao?.message}
          {...register('observacao')}
        />

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
