import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildProductImageObjectKey } from '../../src/application/catalog/product-image.ts';
import { createInMemoryObjectStorage } from '../../src/infrastructure/storage/in-memory-object-storage.ts';
import { createTemporaryDirectoryObjectStorage } from '../../src/infrastructure/storage/temporary-directory-object-storage.ts';

const productId = 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const revision = 'a6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';

await test('object key is server-controlled and adapters preserve only the processed bytes', async () => {
  const key = buildProductImageObjectKey(productId, revision);
  assert.equal(key, `product-images/${productId}/${revision}.webp`);
  const storage = createInMemoryObjectStorage();
  const body = new Uint8Array([1, 2, 3]);
  await storage.put({ body, contentType: 'image/webp', key });
  body[0] = 9;
  assert.deepEqual([...((await storage.get({ key })) as Uint8Array)], [1, 2, 3]);
  await storage.delete({ key });
  await assert.rejects(() => storage.get({ key }));
});

await test('temporary adapter survives a new adapter instance without using provider storage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vpzh-image-test-'));
  try {
    const key = buildProductImageObjectKey(productId, revision);
    const first = createTemporaryDirectoryObjectStorage(directory);
    await first.put({ body: new Uint8Array([4, 5]), contentType: 'image/webp', key });
    const second = createTemporaryDirectoryObjectStorage(directory);
    assert.deepEqual([...((await second.get({ key })) as Uint8Array)], [4, 5]);
    await second.delete({ key });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
