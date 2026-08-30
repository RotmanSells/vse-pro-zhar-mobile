import {
  ProductImageStorageError,
  type ObjectStorage,
  PRODUCT_IMAGE_CONTENT_TYPE,
} from '../../application/catalog/product-image.ts';

export function createInMemoryObjectStorage(): ObjectStorage & {
  readonly objects: Map<string, Uint8Array>;
} {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    put(input) {
      if (input.contentType !== PRODUCT_IMAGE_CONTENT_TYPE) {
        return Promise.reject(new ProductImageStorageError());
      }
      objects.set(input.key, new Uint8Array(input.body));
      return Promise.resolve();
    },
    get(input) {
      const body = objects.get(input.key);
      return body === undefined
        ? Promise.reject(new ProductImageStorageError())
        : Promise.resolve(new Uint8Array(body));
    },
    delete(input) {
      objects.delete(input.key);
      return Promise.resolve();
    },
  };
}
