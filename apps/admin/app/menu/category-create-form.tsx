'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { CreateCategoryResult } from '../../src/application/catalog/category';

export type CategoryCreateAction = (input: {
  readonly name: string;
}) => Promise<CreateCategoryResult>;

export function submitCategoryForm(
  name: string,
  action: CategoryCreateAction,
): Promise<CreateCategoryResult> {
  return action({ name });
}

function errorMessage(reason: string): string {
  switch (reason) {
    case 'configuration':
      return 'Category error: API configuration is unavailable.';
    case 'forbidden':
      return 'Category error: you are not allowed to create a Category.';
    case 'invalid_request':
      return 'Category error: enter a name from 1 to 200 characters.';
    case 'invalid_response':
      return 'Category error: the API returned an invalid response.';
    case 'unauthorized':
      return 'Category error: Admin authentication is unavailable.';
    default:
      return 'Category error: the API is unavailable. Try again.';
  }
}

export function CategoryCreateForm({
  createCategory,
}: {
  readonly createCategory: CategoryCreateAction;
}): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState('');
  const [state, setState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'submitting' }
    | { readonly kind: 'created'; readonly name: string }
    | { readonly kind: 'error'; readonly reason: string }
  >({ kind: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setState({ kind: 'submitting' });
    const result = await submitCategoryForm(name, createCategory);
    if (result.kind === 'created') {
      setName('');
      setState({ kind: 'created', name: result.category.name });
      router.refresh();
      return;
    }
    setState({ kind: 'error', reason: result.reason });
  }

  return (
    <form
      aria-label="Create Category"
      className="category-form"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="form-label" htmlFor="category-name">
        Category name
      </label>
      <input
        aria-describedby="category-name-help"
        id="category-name"
        name="name"
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Горячие блюда"
        value={name}
      />
      <p className="form-help" id="category-name-help">
        1–200 символов. Данные отправляются через существующий Category API.
      </p>
      <button
        className="control-button control-button-primary"
        disabled={state.kind === 'submitting'}
        type="submit"
      >
        {state.kind === 'submitting' ? 'Creating…' : 'Create Category'}
      </button>
      {state.kind === 'created' ? (
        <p className="form-status form-status-success" role="status">
          Category created: {state.name}
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
