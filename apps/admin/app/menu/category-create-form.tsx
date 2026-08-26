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

export async function submitCategoryFormAndRefresh(
  name: string,
  action: CategoryCreateAction,
  refresh: () => void,
): Promise<CreateCategoryResult> {
  const result = await submitCategoryForm(name, action);
  if (result.kind === 'created') refresh();
  return result;
}

function errorMessage(reason: string): string {
  switch (reason) {
    case 'configuration':
      return 'Ошибка категории: конфигурация API недоступна.';
    case 'forbidden':
      return 'Ошибка категории: у вас нет прав на создание категории.';
    case 'invalid_request':
      return 'Ошибка категории: введите название от 1 до 200 символов.';
    case 'invalid_response':
      return 'Ошибка категории: API вернул некорректный ответ.';
    case 'unauthorized':
      return 'Ошибка категории: авторизация администратора недоступна.';
    default:
      return 'Ошибка категории: API недоступен. Попробуйте ещё раз.';
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
    const result = await submitCategoryFormAndRefresh(name, createCategory, () => router.refresh());
    if (result.kind === 'created') {
      setName('');
      setState({ kind: 'created', name: result.category.name });
      return;
    }
    setState({ kind: 'error', reason: result.reason });
  }

  return (
    <form
      aria-label="Создать категорию"
      className="category-form"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="form-label" htmlFor="category-name">
        Название категории
      </label>
      <input
        aria-describedby="category-name-help"
        id="category-name"
        name="name"
        onChange={(event) => setName(event.target.value)}
        placeholder="например, Горячие блюда"
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
        {state.kind === 'submitting' ? 'Создание…' : 'Создать категорию'}
      </button>
      {state.kind === 'created' ? (
        <p className="form-status form-status-success" role="status">
          Категория создана: {state.name}
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
