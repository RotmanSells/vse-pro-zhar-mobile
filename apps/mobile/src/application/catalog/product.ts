import type { ProductListResponse } from '@vse-pro-zhar/contracts';

export type ProductLoadFailureReason =
  'configuration' | 'http' | 'invalid_response' | 'network' | 'timeout';

export type ProductLoadResult =
  | { readonly kind: 'loaded'; readonly products: ProductListResponse }
  | { readonly kind: 'failure'; readonly reason: ProductLoadFailureReason };

export interface ProductListPort {
  listProducts(): Promise<ProductLoadResult>;
}

export async function loadProducts(port: ProductListPort): Promise<ProductLoadResult> {
  try {
    return await port.listProducts();
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}
