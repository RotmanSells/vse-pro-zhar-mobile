import { readRepository } from '../../infrastructure/repository';

export function AdminPage(): string {
  return readRepository();
}
