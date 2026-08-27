import { createCategoryAction, listCategoriesAction } from './category-actions';
import { CategoryCreateForm } from './category-create-form';
import { createProductAction } from './product-actions';
import { ProductCreateForm } from './product-create-form';

export const dynamic = 'force-dynamic';

export default async function MenuPage(): Promise<React.ReactElement> {
  const categoriesResult = await listCategoriesAction();
  const categories = categoriesResult.kind === 'loaded' ? categoriesResult.categories : [];
  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">КАТАЛОГ</p>
          <h1 className="page-title">Меню</h1>
          <p className="page-subtitle">Создайте категорию для тестового каталога.</p>
        </div>
        <a className="control-button control-button-secondary" href="/">
          ← На главную
        </a>
      </header>
      <section className="content-card">
        <header className="card-header">
          <div>
            <h2>Создать категорию</h2>
            <p>Добавьте раздел, который будет отображаться в мобильном каталоге.</p>
          </div>
          <span aria-hidden="true" className="card-icon">
            🔥
          </span>
        </header>
        <CategoryCreateForm createCategory={createCategoryAction} />
      </section>
      <section className="content-card">
        <header className="card-header">
          <div>
            <h2>Создать товар</h2>
            <p>Добавьте блюдо в существующий раздел меню.</p>
          </div>
          <span aria-hidden="true" className="card-icon">
            ✦
          </span>
        </header>
        {categories.length > 0 ? (
          <ProductCreateForm categories={categories} createProduct={createProductAction} />
        ) : (
          <p className="form-status form-status-error" role="alert">
            Ошибка товара: существующие категории недоступны.
          </p>
        )}
      </section>
    </section>
  );
}
