import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

import {
  ProductImageStorageError,
  type ObjectStorage,
  PRODUCT_IMAGE_CONTENT_TYPE,
  type StoredObject,
} from '../../application/catalog/product-image.ts';

export interface YandexS3ObjectStorageOptions {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly requestTimeoutMs?: number;
  readonly maxAttempts?: number;
  readonly client?: S3Client;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    Symbol.asyncIterator in value
  );
}

export function createYandexS3ObjectStorage(options: YandexS3ObjectStorageOptions): ObjectStorage {
  const requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
  const maxAttempts = options.maxAttempts ?? 3;
  const client =
    options.client ??
    new S3Client({
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      endpoint: options.endpoint,
      maxAttempts,
      region: options.region,
    } satisfies S3ClientConfig);

  async function send<T>(
    command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      return (await client.send(command, { abortSignal: controller.signal })) as T;
    } catch {
      throw new ProductImageStorageError();
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async put(input) {
      if (input.contentType !== PRODUCT_IMAGE_CONTENT_TYPE) throw new ProductImageStorageError();
      await send<void>(
        new PutObjectCommand({
          Body: input.body,
          Bucket: options.bucket,
          ContentType: PRODUCT_IMAGE_CONTENT_TYPE,
          Key: input.key,
        }),
      );
    },
    async get(input) {
      const response = await send<{ readonly Body?: unknown }>(
        new GetObjectCommand({ Bucket: options.bucket, Key: input.key }),
      );
      if (response.Body === undefined || !isAsyncIterable(response.Body)) {
        throw new ProductImageStorageError();
      }
      return response.Body;
    },
    async delete(input) {
      await send<void>(new DeleteObjectCommand({ Bucket: options.bucket, Key: input.key }));
    },
  };
}

export class YandexS3ObjectStorage implements ObjectStorage {
  private readonly delegate: ObjectStorage;

  constructor(options: YandexS3ObjectStorageOptions) {
    this.delegate = createYandexS3ObjectStorage(options);
  }

  put(input: Parameters<ObjectStorage['put']>[0]): Promise<void> {
    return this.delegate.put(input);
  }

  get(input: Parameters<ObjectStorage['get']>[0]): Promise<StoredObject> {
    return this.delegate.get(input);
  }

  delete(input: Parameters<ObjectStorage['delete']>[0]): Promise<void> {
    return this.delegate.delete(input);
  }
}
