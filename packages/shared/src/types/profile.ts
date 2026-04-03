import type { UUID, Objetivo } from './common';

export interface Profile {
  id: UUID;
  nome: string;
  email: string;
  avatar_url: string | null;
  peso_atual: number | null;
  altura: number | null;
  meta_peso: number | null;
  meta_calorias: number;
  meta_agua: number;
  objetivo: Objetivo | null;
  onboarding_feito: boolean;
  created_at: string;
}

export interface ProfileUpdate {
  nome?: string;
  avatar_url?: string | null;
  peso_atual?: number | null;
  altura?: number | null;
  meta_peso?: number | null;
  meta_calorias?: number;
  meta_agua?: number;
  objetivo?: Objetivo | null;
  onboarding_feito?: boolean;
}
