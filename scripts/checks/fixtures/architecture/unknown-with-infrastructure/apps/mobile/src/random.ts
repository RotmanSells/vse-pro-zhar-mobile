import { persist } from './infrastructure/repository';

export function random(): string {
  return persist();
}
