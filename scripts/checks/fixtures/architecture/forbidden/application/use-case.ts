import { persist } from '../infrastructure/repository';

export function executeUseCase(): string {
  return persist();
}
