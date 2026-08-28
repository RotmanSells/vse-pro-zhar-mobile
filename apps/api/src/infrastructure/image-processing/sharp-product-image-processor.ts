import sharp from 'sharp';

import type {
  ProcessedProductImage,
  ProductImageProcessor,
} from '../../application/catalog/product-image.ts';

export const PRODUCT_IMAGE_MAX_FILE_BYTES = 10_485_760;
export const PRODUCT_IMAGE_MAX_BODY_BYTES = 10_551_296;
export const PRODUCT_IMAGE_MAX_PIXELS = 25_000_000;
export const PRODUCT_IMAGE_MAX_DIMENSION = 10_000;
export const PRODUCT_IMAGE_MAX_PROCESSING_SECONDS = 5;
export const PRODUCT_IMAGE_MAX_OUTPUT_DIMENSION = 1_600;

export class InvalidProductImageError extends Error {
  constructor() {
    super('Product image is invalid');
    this.name = 'InvalidProductImageError';
  }
}

function hasPngChunk(input: Uint8Array, target: string): boolean {
  if (input.byteLength < 24 || input[0] !== 0x89 || input[1] !== 0x50) return false;
  let offset = 8;
  while (offset + 12 <= input.byteLength) {
    const length =
      input[offset] === undefined
        ? -1
        : new DataView(input.buffer, input.byteOffset + offset, 4).getUint32(0);
    if (length < 0 || offset + 12 + length > input.byteLength) return false;
    const type = String.fromCharCode(
      input[offset + 4] ?? 0,
      input[offset + 5] ?? 0,
      input[offset + 6] ?? 0,
      input[offset + 7] ?? 0,
    );
    if (type === target) return true;
    offset += 12 + length;
  }
  return false;
}

function hasWebpChunk(input: Uint8Array, target: string): boolean {
  if (input.byteLength < 12 || String.fromCharCode(...input.slice(0, 4)) !== 'RIFF') return false;
  let offset = 12;
  while (offset + 8 <= input.byteLength) {
    const type = String.fromCharCode(
      input[offset] ?? 0,
      input[offset + 1] ?? 0,
      input[offset + 2] ?? 0,
      input[offset + 3] ?? 0,
    );
    const length = new DataView(input.buffer, input.byteOffset + offset + 4, 4).getUint32(0, true);
    if (type === target) return true;
    offset += 8 + length + (length % 2);
  }
  return false;
}

function rejectAnimated(input: Uint8Array, format: string): void {
  if (format === 'png' && hasPngChunk(input, 'acTL')) throw new InvalidProductImageError();
  if (format === 'webp' && (hasWebpChunk(input, 'ANIM') || hasWebpChunk(input, 'ANMF'))) {
    throw new InvalidProductImageError();
  }
}

export function createSharpProductImageProcessor(): ProductImageProcessor {
  return {
    async process(input): Promise<ProcessedProductImage> {
      if (input.byteLength === 0 || input.byteLength > PRODUCT_IMAGE_MAX_FILE_BYTES) {
        throw new InvalidProductImageError();
      }
      try {
        const image = sharp(input, {
          animated: false,
          failOn: 'warning',
          limitInputChannels: 4,
          limitInputPixels: PRODUCT_IMAGE_MAX_PIXELS,
          pages: 1,
          sequentialRead: true,
        });
        const metadata = await image.metadata();
        if (metadata.format !== 'jpeg' && metadata.format !== 'png' && metadata.format !== 'webp') {
          throw new InvalidProductImageError();
        }
        rejectAnimated(input, metadata.format);
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;
        const channels = metadata.channels ?? 0;
        if (
          width < 1 ||
          height < 1 ||
          width > PRODUCT_IMAGE_MAX_DIMENSION ||
          height > PRODUCT_IMAGE_MAX_DIMENSION ||
          width * height > PRODUCT_IMAGE_MAX_PIXELS ||
          channels < 1 ||
          channels > 4 ||
          (metadata.pages !== undefined && metadata.pages > 1)
        ) {
          throw new InvalidProductImageError();
        }
        const data = await image
          .rotate()
          .resize({
            fit: 'inside',
            height: PRODUCT_IMAGE_MAX_OUTPUT_DIMENSION,
            withoutEnlargement: true,
            width: PRODUCT_IMAGE_MAX_OUTPUT_DIMENSION,
          })
          .toColorspace('srgb')
          .webp({ quality: 82 })
          .timeout({ seconds: PRODUCT_IMAGE_MAX_PROCESSING_SECONDS })
          .toBuffer();
        return { contentType: 'image/webp', data };
      } catch (error) {
        if (error instanceof InvalidProductImageError) throw error;
        throw new InvalidProductImageError();
      }
    },
  };
}
