import type {
  ProductDetailsResponse,
  ProductDetailsWithImageResponse,
  ProductResponse,
  ProductWithImageResponse,
} from '@vse-pro-zhar/contracts';

export type MobileProductResponse = ProductResponse | ProductWithImageResponse;
export type MobileProductDetailsResponse = ProductDetailsResponse | ProductDetailsWithImageResponse;

export type ProductLoadFailureReason =
  'configuration' | 'http' | 'invalid_response' | 'network' | 'timeout';
export type ProductDetailsLoadFailureReason = ProductLoadFailureReason | 'not_found';

export type ProductLoadResult =
  | { readonly kind: 'loaded'; readonly products: readonly MobileProductResponse[] }
  | { readonly kind: 'failure'; readonly reason: ProductLoadFailureReason };
export type ProductDetailsLoadResult =
  | { readonly kind: 'loaded'; readonly product: MobileProductDetailsResponse }
  | { readonly kind: 'failure'; readonly reason: ProductDetailsLoadFailureReason };

export interface ProductListPort {
  listProducts(): Promise<ProductLoadResult>;
}
export interface ProductDetailsPort {
  getProduct(id: string): Promise<ProductDetailsLoadResult>;
}

export async function loadProducts(port: ProductListPort): Promise<ProductLoadResult> {
  try {
    return await port.listProducts();
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}

export async function loadProductDetails(
  id: string,
  port: ProductDetailsPort,
): Promise<ProductDetailsLoadResult> {
  try {
    return await port.getProduct(id);
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}
