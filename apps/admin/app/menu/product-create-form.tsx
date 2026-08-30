'use client';

import { useState, type FormEvent } from 'react';

import type { CategoryResponse } from '../../../../packages/contracts/src/category';
import type { CreateProductResult } from '../../src/application/catalog/product';
export type ProductCreateAction = (input: {
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceRub: string;
  readonly adminEnabled: boolean;
  readonly image?: Blob;
}) => Promise<CreateProductResult>;
export function submitProductForm(
  input: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceRub: string;
    readonly adminEnabled: boolean;
    readonly image?: Blob;
  },
  action: ProductCreateAction,
): Promise<CreateProductResult> {
  return action(input);
}
function errorMessage(reason: string): string {
  switch (reason) {
    case 'conflict':
      return 'Ошибка товара: данные товара изменились. Повторите операцию.';
    case 'configuration':
      return 'Ошибка товара: конфигурация API недоступна.';
    case 'forbidden':
      return 'Ошибка товара: у вас нет прав на создание товара.';
    case 'invalid_request':
      return 'Ошибка товара: укажите категорию, название и положительную цену в рублях.';
    case 'invalid_response':
      return 'Ошибка товара: API вернул некорректный ответ.';
    case 'not_found':
      return 'Ошибка товара: выбранная категория больше не существует.';
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
export function ProductCreateForm({
  categories,
  createProduct,
}: {
  readonly categories: readonly CategoryResponse[];
  readonly createProduct: ProductCreateAction;
}): React.ReactElement {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [basePriceRub, setBasePriceRub] = useState('');
  const [adminEnabled, setAdminEnabled] = useState<'true' | 'false' | undefined>();
  const [image, setImage] = useState<File | undefined>();
  const [state, setState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'submitting' }
    | { readonly kind: 'created'; readonly name: string }
    | { readonly kind: 'error'; readonly reason: string }
  >({ kind: 'idle' });
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (adminEnabled === undefined || image === undefined) {
      setState({ kind: 'error', reason: 'invalid_request' });
      return;
    }
    setState({ kind: 'submitting' });
    const result = await submitProductForm(
      {
        adminEnabled: adminEnabled === 'true',
        basePriceRub,
        categoryId,
        image,
        name,
      },
      createProduct,
    );
    if (result.kind === 'created') {
      setName('');
      setBasePriceRub('');
      setState({ kind: 'created', name: result.product.name });
      return;
    }
    setState({ kind: 'error', reason: result.reason });
  }
  return (
    <form
      aria-label="Создать товар"
      className="product-form"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="form-label" htmlFor="product-category">
        Категория
      </label>
      <select
        id="product-category"
        name="categoryId"
        onChange={(event) => setCategoryId(event.target.value)}
        value={categoryId}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <label className="form-label" htmlFor="product-name">
        Название товара
      </label>
      <input
        id="product-name"
        name="name"
        onChange={(event) => setName(event.target.value)}
        placeholder="Введите название блюда"
        value={name}
      />
      <label className="form-label" htmlFor="product-price">
        Базовая цена, руб.
      </label>
      <input
        id="product-price"
        inputMode="decimal"
        name="basePriceRub"
        onChange={(event) => setBasePriceRub(event.target.value)}
        placeholder="450"
        value={basePriceRub}
      />
      <fieldset className="product-enabled-fieldset">
        <legend className="form-label">Видимость в каталоге</legend>
        <label className="radio-label">
          <input
            checked={adminEnabled === 'true'}
            name="adminEnabled"
            onChange={() => setAdminEnabled('true')}
            type="radio"
            value="true"
          />
          Показывать в каталоге
        </label>
        <label className="radio-label">
          <input
            checked={adminEnabled === 'false'}
            name="adminEnabled"
            onChange={() => setAdminEnabled('false')}
            type="radio"
            value="false"
          />
          Скрыть из каталога
        </label>
      </fieldset>
      <label className="form-label" htmlFor="product-image">
        Главное изображение
      </label>
      <input
        accept="image/jpeg,image/png,image/webp"
        id="product-image"
        name="image"
        onChange={(event) => setImage(event.target.files?.[0])}
        required
        type="file"
      />
      <p className="form-help">
        Цена хранится в бэкенде в целых копейках. Изображение будет проверено и сохранено как WebP.
      </p>
      <button
        className="control-button control-button-primary"
        disabled={state.kind === 'submitting' || categories.length === 0}
        type="submit"
      >
        {state.kind === 'submitting' ? 'Создание…' : 'Создать товар'}
      </button>
      {state.kind === 'created' ? (
        <p className="form-status form-status-success" role="status">
          Товар создан: {state.name}
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
