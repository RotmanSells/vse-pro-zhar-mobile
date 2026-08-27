'use client';

import { useState, type FormEvent } from 'react';

import type { ProductResponse } from '../../../../packages/contracts/src/product';
import type { UpdateProductDetailsResult } from '../../src/application/catalog/product';

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

function errorMessage(reason: string): string {
  switch (reason) {
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
    default:
      return 'Ошибка товара: API недоступен. Попробуйте ещё раз.';
  }
}

export function ProductDetailsForm({
  product,
  categoryName,
  updateProductDetails,
}: {
  readonly product: ProductResponse;
  readonly categoryName: string;
  readonly updateProductDetails: ProductDetailsAction;
}): React.ReactElement {
  const [description, setDescription] = useState(product.description ?? '');
  const [weightGrams, setWeightGrams] = useState(
    product.weightGrams === null ? '' : String(product.weightGrams),
  );
  const [isNew, setIsNew] = useState(product.isNew);
  const [isHit, setIsHit] = useState(product.isHit);
  const [state, setState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'submitting' }
    | { readonly kind: 'updated'; readonly name: string }
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
