'use client';

import { useState, type FormEvent } from 'react';

import type { ProductResponse } from '../../../../packages/contracts/src/product';
import type {
  UpdateProductDetailsResult,
  UpdateProductImageResult,
  UpdateProductVisibilityResult,
} from '../../src/application/catalog/product';

export type ProductDetailsAction = (input: {
  readonly id: string;
  readonly description: string;
  readonly weightGrams: string;
  readonly isNew: boolean;
  readonly isHit: boolean;
}) => Promise<UpdateProductDetailsResult>;

export function submitProductDetailsForm(
  input: Parameters<ProductDetailsAction>[0],
  action: ProductDetailsAction,
): Promise<UpdateProductDetailsResult> {
  return action(input);
}

export type ProductImageAction = (input: {
  readonly id: string;
  readonly image?: Blob;
}) => Promise<UpdateProductImageResult>;

export function submitProductImageForm(
  input: Parameters<ProductImageAction>[0],
  action: ProductImageAction,
): Promise<UpdateProductImageResult> {
  return action(input);
}

export type ProductVisibilityAction = (input: {
  readonly id: string;
  readonly adminEnabled: boolean;
}) => Promise<UpdateProductVisibilityResult>;

export function submitProductVisibilityForm(
  input: Parameters<ProductVisibilityAction>[0],
  action: ProductVisibilityAction,
): Promise<UpdateProductVisibilityResult> {
  return action(input);
}

function errorMessage(reason: string): string {
  switch (reason) {
    case 'conflict':
      return 'Ошибка товара: изображение уже заменено. Обновите страницу.';
    case 'configuration':
      return 'Ошибка товара: конфигурация API недоступна.';
    case 'forbidden':
      return 'Ошибка товара: у вас нет прав на изменение товара.';
    case 'invalid_request':
      return 'Ошибка товара: проверьте описание и вес.';
    case 'invalid_response':
      return 'Ошибка товара: API вернул некорректный ответ.';
    case 'not_found':
      return 'Ошибка товара: товар больше не существует.';
    case 'unauthorized':
      return 'Ошибка товара: авторизация администратора недоступна.';
    case 'payload_too_large':
      return 'Ошибка товара: файл изображения слишком большой.';
    case 'invalid_image':
      return 'Ошибка товара: изображение не прошло проверку.';
    case 'storage':
      return 'Ошибка товара: хранилище изображений недоступно.';
    default:
      return 'Ошибка товара: API недоступен. Попробуйте ещё раз.';
  }
}

export function ProductDetailsForm({
  product,
  categoryName,
  updateProductDetails,
  updateProductVisibility,
  replaceProductImage,
}: {
  readonly product: ProductResponse;
  readonly categoryName: string;
  readonly updateProductDetails: ProductDetailsAction;
  readonly updateProductVisibility?: ProductVisibilityAction;
  readonly replaceProductImage?: ProductImageAction;
}): React.ReactElement {
  const [description, setDescription] = useState(product.description ?? '');
  const [weightGrams, setWeightGrams] = useState(
    product.weightGrams === null ? '' : String(product.weightGrams),
  );
  const [isNew, setIsNew] = useState(product.isNew);
  const [isHit, setIsHit] = useState(product.isHit);
  const [adminEnabled, setAdminEnabled] = useState(product.adminEnabled);
  const [image, setImage] = useState<File | undefined>();
  const [imageState, setImageState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'submitting' }
    | { readonly kind: 'updated' }
    | { readonly kind: 'error'; readonly reason: string }
  >({ kind: 'idle' });
  const [state, setState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'submitting' }
    | { readonly kind: 'updated'; readonly name: string }
    | { readonly kind: 'error'; readonly reason: string }
  >({ kind: 'idle' });
  const [visibilityState, setVisibilityState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'submitting' }
    | { readonly kind: 'updated'; readonly adminEnabled: boolean }
    | { readonly kind: 'error'; readonly reason: string }
  >({ kind: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setState({ kind: 'submitting' });
    const result = await submitProductDetailsForm(
      { description, id: product.id, isHit, isNew, weightGrams },
      updateProductDetails,
    );
    if (result.kind === 'updated') {
      setDescription(result.product.description ?? '');
      setWeightGrams(result.product.weightGrams === null ? '' : String(result.product.weightGrams));
      setIsNew(result.product.isNew);
      setIsHit(result.product.isHit);
      setState({ kind: 'updated', name: result.product.name });
      return;
    }
    setState({ kind: 'error', reason: result.reason });
  }

  async function handleImageSubmit(): Promise<void> {
    if (replaceProductImage === undefined || image === undefined) {
      setImageState({ kind: 'error', reason: 'invalid_request' });
      return;
    }
    setImageState({ kind: 'submitting' });
    const result = await submitProductImageForm({ id: product.id, image }, replaceProductImage);
    if (result.kind === 'updated') {
      setImage(undefined);
      setImageState({ kind: 'updated' });
      return;
    }
    setImageState({ kind: 'error', reason: result.reason });
  }

  async function handleVisibilitySubmit(): Promise<void> {
    if (updateProductVisibility === undefined) {
      setVisibilityState({ kind: 'error', reason: 'configuration' });
      return;
    }
    setVisibilityState({ kind: 'submitting' });
    const result = await submitProductVisibilityForm(
      { adminEnabled, id: product.id },
      updateProductVisibility,
    );
    if (result.kind === 'updated') {
      setAdminEnabled(result.product.adminEnabled);
      setVisibilityState({ kind: 'updated', adminEnabled: result.product.adminEnabled });
      return;
    }
    setVisibilityState({ kind: 'error', reason: result.reason });
  }

  return (
    <form
      aria-label={`Детали товара ${product.name}`}
      className="product-details-form"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="product-details-summary">
        <strong>{product.name}</strong>
        <span>{categoryName}</span>
        <span>{formatPrice(product.basePriceMinor)}</span>
      </div>
      {replaceProductImage === undefined ? null : (
        <div className="product-image-replacement">
          <label className="form-label" htmlFor={`product-image-${product.id}`}>
            Заменить изображение
          </label>
          <input
            accept="image/jpeg,image/png,image/webp"
            id={`product-image-${product.id}`}
            name="image"
            onChange={(event) => setImage(event.target.files?.[0])}
            type="file"
          />
          <button
            className="control-button control-button-secondary"
            disabled={imageState.kind === 'submitting'}
            onClick={() => void handleImageSubmit()}
            type="button"
          >
            {imageState.kind === 'submitting' ? 'Замена…' : 'Заменить изображение'}
          </button>
          {imageState.kind === 'updated' ? (
            <p className="form-status form-status-success" role="status">
              Изображение заменено.
            </p>
          ) : null}
          {imageState.kind === 'error' ? (
            <p className="form-status form-status-error" role="alert">
              {errorMessage(imageState.reason)}
            </p>
          ) : null}
        </div>
      )}
      {updateProductVisibility === undefined ? null : (
        <fieldset className="product-visibility-fieldset">
          <legend className="form-label">Видимость в каталоге</legend>
          <label className="radio-label">
            <input
              checked={adminEnabled}
              onChange={(event) => setAdminEnabled(event.target.checked)}
              name={`visibility-${product.id}`}
              type="radio"
            />
            Показывать в каталоге
          </label>
          <label className="radio-label">
            <input
              checked={!adminEnabled}
              onChange={(event) => setAdminEnabled(!event.target.checked)}
              name={`visibility-${product.id}`}
              type="radio"
            />
            Скрыть из каталога
          </label>
          <p className="form-help">
            {adminEnabled
              ? 'Товар виден в мобильном каталоге.'
              : 'Товар скрыт из мобильного каталога, но сохранён в админке.'}
          </p>
          <button
            className="control-button control-button-secondary"
            disabled={visibilityState.kind === 'submitting'}
            onClick={() => void handleVisibilitySubmit()}
            type="button"
          >
            {visibilityState.kind === 'submitting' ? 'Сохранение…' : 'Сохранить видимость'}
          </button>
          {visibilityState.kind === 'updated' ? (
            <p className="form-status form-status-success" role="status">
              {visibilityState.adminEnabled
                ? 'Товар показывается в каталоге.'
                : 'Товар скрыт из каталога.'}
            </p>
          ) : null}
          {visibilityState.kind === 'error' ? (
            <p className="form-status form-status-error" role="alert">
              {errorMessage(visibilityState.reason)}
            </p>
          ) : null}
        </fieldset>
      )}
      <label className="form-label" htmlFor={`product-description-${product.id}`}>
        Описание и состав
      </label>
      <textarea
        id={`product-description-${product.id}`}
        maxLength={500}
        name="description"
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Коротко опишите блюдо и его состав"
        rows={3}
        value={description}
      />
      <label className="form-label" htmlFor={`product-weight-${product.id}`}>
        Вес, г
      </label>
      <input
        id={`product-weight-${product.id}`}
        inputMode="numeric"
        min="1"
        name="weightGrams"
        onChange={(event) => setWeightGrams(event.target.value)}
        placeholder="Например, 350"
        value={weightGrams}
      />
      <fieldset className="product-badges-fieldset">
        <legend className="form-label">Метки</legend>
        <label className="checkbox-label">
          <input
            checked={isNew}
            onChange={(event) => setIsNew(event.target.checked)}
            type="checkbox"
          />
          Новинка
        </label>
        <label className="checkbox-label">
          <input
            checked={isHit}
            onChange={(event) => setIsHit(event.target.checked)}
            type="checkbox"
          />
          Хит
        </label>
      </fieldset>
      <p className="form-help">
        Описание можно оставить пустым. Название, цена и категория не изменяются здесь.
      </p>
      <button
        className="control-button control-button-primary"
        disabled={state.kind === 'submitting'}
        type="submit"
      >
        {state.kind === 'submitting' ? 'Сохранение…' : 'Сохранить детали'}
      </button>
      {state.kind === 'updated' ? (
        <p className="form-status form-status-success" role="status">
          Детали сохранены: {state.name}
        </p>
      ) : null}
      {state.kind === 'error' ? (
        <p className="form-status form-status-error" role="alert">
          {errorMessage(state.reason)}
        </p>
      ) : null}
    </form>
  );
}

function formatPrice(basePriceMinor: number): string {
  const rubles = Math.floor(basePriceMinor / 100).toLocaleString('ru-RU');
  const kopecks = String(basePriceMinor % 100).padStart(2, '0');
  return kopecks === '00' ? `${rubles} ₽` : `${rubles},${kopecks} ₽`;
}
