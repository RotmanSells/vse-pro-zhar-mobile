import { persist } from './infrastructure/repository';
import { render } from './presentation/shell';

export function start(): string {
  return `${persist()} ${render()}`;
}
