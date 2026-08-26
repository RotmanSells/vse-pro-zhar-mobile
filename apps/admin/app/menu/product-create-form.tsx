'use client';

import { useState, type FormEvent } from 'react';

import type { CategoryResponse } from '../../../../packages/contracts/src/category';
import type { CreateProductResult } from '../../src/application/catalog/product';
export type ProductCreateAction = (input: {
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceRub: string;
  readonly adminEnabled: boolean;
}) => Promise<CreateProductResult>;
export function submitProductForm(
  input: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceRub: string;
    readonly adminEnabled: boolean;
  },
  action: ProductCreateAction,
): Promise<CreateProductResult> {
  return action(input);
}
function errorMessage(reason: string): string {
  switch (reason) {
    case 'configuration':
      return 'Product error: API configuration is unavailable.';
    case 'forbidden':
      return 'Product error: you are not allowed to create a Product.';
    case 'invalid_request':
      return 'Product error: enter a Category, name and a positive RUB price.';
    case 'invalid_response':
      return 'Product error: the API returned an invalid response.';
    case 'not_found':
      return 'Product error: the selected Category no longer exists.';
    case 'unauthorized':
      return 'Product error: Admin authentication is unavailable.';
    default:
      return 'Product error: the API is unavailable. Try again.';
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
  const [state, setState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'submitting' }
    | { readonly kind: 'created'; readonly name: string }
    | { readonly kind: 'error'; readonly reason: string }
  >({ kind: 'idle' });
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (adminEnabled === undefined) {
      setState({ kind: 'error', reason: 'invalid_request' });
      return;
    }
    setState({ kind: 'submitting' });
    const result = await submitProductForm(
      { adminEnabled: adminEnabled === 'true', basePriceRub, categoryId, name },
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
      aria-label="Create Product"
      className="product-form"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="form-label" htmlFor="product-category">
        Category
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
        Product name
      </label>
      <input
        id="product-name"
        name="name"
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Шашлык из свинины"
        value={name}
      />
      <label className="form-label" htmlFor="product-price">
        Base price, RUB
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
        <legend className="form-label">Admin visibility</legend>
        <label className="radio-label">
          <input
            checked={adminEnabled === 'true'}
            name="adminEnabled"
            onChange={() => setAdminEnabled('true')}
            type="radio"
            value="true"
          />
          Visible in catalog
        </label>
        <label className="radio-label">
          <input
            checked={adminEnabled === 'false'}
            name="adminEnabled"
            onChange={() => setAdminEnabled('false')}
            type="radio"
            value="false"
          />
          Hidden from catalog
        </label>
      </fieldset>
      <p className="form-help">
        Цена хранится в backend как целые копейки RUB. Видимость выбирается явно; она не означает
        доступность заказа.
      </p>
      <button
        className="control-button control-button-primary"
        disabled={state.kind === 'submitting' || categories.length === 0}
        type="submit"
      >
        {state.kind === 'submitting' ? 'Creating…' : 'Create Product'}
      </button>
      {state.kind === 'created' ? (
        <p className="form-status form-status-success" role="status">
          Product created: {state.name}
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
