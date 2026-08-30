import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  ProductImageStorageError,
  type ObjectStorage,
  PRODUCT_IMAGE_CONTENT_TYPE,
} from '../../application/catalog/product-image.ts';

export function createTemporaryDirectoryObjectStorage(directory: string): ObjectStorage {
  const objectPath = (key: string): string => {
    const root = resolve(directory);
    const path = resolve(root, key);
    if (path !== root && !path.startsWith(`${root}/`)) throw new ProductImageStorageError();
    return path;
  };
  return {
    async put(input) {
      if (input.contentType !== PRODUCT_IMAGE_CONTENT_TYPE) throw new ProductImageStorageError();
      const path = objectPath(input.key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, input.body);
    },
    async get(input) {
      try {
        return await readFile(objectPath(input.key));
      } catch {
        throw new ProductImageStorageError();
      }
    },
    async delete(input) {
      try {
        await rm(objectPath(input.key), { force: true });
      } catch {
        throw new ProductImageStorageError();
      }
    },
  };
}
