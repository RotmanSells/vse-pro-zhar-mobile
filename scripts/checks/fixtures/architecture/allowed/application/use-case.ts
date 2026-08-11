import { calculatePrice } from '../domain/price';

export function executeUseCase(): number {
  return calculatePrice(100);
}
