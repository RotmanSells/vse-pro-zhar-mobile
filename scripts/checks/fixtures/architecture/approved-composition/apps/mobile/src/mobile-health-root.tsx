import { persist } from '../infrastructure/repository';
import { render } from '../presentation/shell';

export function MobileHealthRoot(): string {
  return `${persist()} ${render()}`;
}
