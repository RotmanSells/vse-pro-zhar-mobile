import {
  CreateProductRequestSchema,
  PRODUCT_BASE_PRICE_MINOR_MAX,
  ProductResponseSchema,
  type ProductResponse,
} from '../../../../../packages/contracts/src/product';

export type AdminProductFailureReason =
  | 'configuration'
  | 'forbidden'
  | 'http'
  | 'invalid_request'
  | 'invalid_response'
  | 'network'
  | 'not_found'
  | 'timeout'
  | 'unauthorized';

export type CreateProductResult =
  | { readonly kind: 'created'; readonly product: ProductResponse }
  | { readonly kind: 'failure'; readonly reason: AdminProductFailureReason };

export interface CreateProductPort {
  createProduct(input: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceMinor: number;
    readonly adminEnabled: boolean;
  }): Promise<CreateProductResult>;
}

const RUB_PRICE_PATTERN = /^(?:0|[1-9][0-9]*)(?:[.,][0-9]{1,2})?$/u;

export function parseRubPriceToMinorUnits(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!RUB_PRICE_PATTERN.test(normalized)) return undefined;

  const [wholePart = '0', fractionPart = ''] = normalized.split('.');
  const minorUnits = BigInt(wholePart) * 100n + BigInt(fractionPart.padEnd(2, '0') || '0');
  const maximum = BigInt(PRODUCT_BASE_PRICE_MINOR_MAX);
  if (minorUnits < 1n || minorUnits > maximum) return undefined;
  return Number(minorUnits);
}

export async function submitProduct(
  input: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceRub: string;
    readonly adminEnabled: boolean;
  },
  port: CreateProductPort,
): Promise<CreateProductResult> {
  const basePriceMinor = parseRubPriceToMinorUnits(input.basePriceRub);
  if (basePriceMinor === undefined) return { kind: 'failure', reason: 'invalid_request' };

  const parsedInput = CreateProductRequestSchema.safeParse({
    adminEnabled: input.adminEnabled,
    basePriceMinor,
    categoryId: input.categoryId,
    name: input.name,
  });
  if (!parsedInput.success) return { kind: 'failure', reason: 'invalid_request' };

  try {
    const result = await port.createProduct(parsedInput.data);
    if (result.kind === 'failure') return result;
    const parsedProduct = ProductResponseSchema.safeParse(result.product);
    return parsedProduct.success
      ? { kind: 'created', product: parsedProduct.data }
      : { kind: 'failure', reason: 'invalid_response' };
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}
