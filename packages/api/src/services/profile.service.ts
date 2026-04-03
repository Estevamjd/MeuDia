import { profileRepository } from '../repositories';
import { profileUpdateSchema } from '../validators';

export async function obterPerfil(userId: string) {
  return profileRepository.findById(userId);
}

export async function atualizarPerfil(userId: string, data: unknown) {
  const parsed = profileUpdateSchema.parse(data);
  return profileRepository.update(userId, parsed);
}
