import { readRepository } from '../../infrastructure/repository';

export function MobileShell(): string {
  return readRepository();
}
