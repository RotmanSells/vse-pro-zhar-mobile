import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import {
  createSharpProductImageProcessor,
  InvalidProductImageError,
  PRODUCT_IMAGE_MAX_OUTPUT_DIMENSION,
} from '../../src/infrastructure/image-processing/sharp-product-image-processor.ts';

async function createInput(options: {
  readonly width: number;
  readonly height: number;
  readonly format: 'jpeg' | 'png' | 'webp';
}): Promise<Buffer> {
  const image = sharp({
    create: {
      channels: 4,
      background: { alpha: 0.5, b: 20, g: 100, r: 220 },
      height: options.height,
      width: options.width,
    },
  });
  if (options.format === 'jpeg') return image.jpeg().toBuffer();
  if (options.format === 'webp') return image.webp().toBuffer();
  return image.png().toBuffer();
}

await test('Sharp processor accepts supported signatures and produces bounded metadata-free WebP', async () => {
  const processor = createSharpProductImageProcessor();
  const input = await createInput({ format: 'png', height: 100, width: 2_000 });
  const result = await processor.process(input);
  const metadata = await sharp(result.data).metadata();
  assert.equal(result.contentType, 'image/webp');
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, PRODUCT_IMAGE_MAX_OUTPUT_DIMENSION);
  assert.equal(metadata.height, 80);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(metadata.xmp, undefined);
});

await test('Sharp processor accepts JPEG and WebP but rejects malformed and unsupported input', async () => {
  const processor = createSharpProductImageProcessor();
  for (const format of ['jpeg', 'webp'] as const) {
    const result = await processor.process(await createInput({ format, height: 4, width: 4 }));
    assert.equal((await sharp(result.data).metadata()).format, 'webp');
  }
  await assert.rejects(
    () => processor.process(Buffer.from('not-an-image')),
    InvalidProductImageError,
  );
  await assert.rejects(() => processor.process(Buffer.alloc(0)), InvalidProductImageError);
});

await test('Sharp processor rejects dimensions beyond the declared safety boundary', async () => {
  const processor = createSharpProductImageProcessor();
  const oversized = await createInput({ format: 'png', height: 1, width: 10_001 });
  await assert.rejects(() => processor.process(oversized), InvalidProductImageError);
});
