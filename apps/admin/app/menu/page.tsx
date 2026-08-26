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
          <p className="eyebrow">CATALOG</p>
          <h1 className="page-title">Menu</h1>
          <p className="page-subtitle">Create a Category for the development/test catalog.</p>
        </div>
        <a className="control-button control-button-secondary" href="/">
          ← Dashboard
        </a>
      </header>
      <section className="content-card">
        <header className="card-header">
          <div>
            <h2>Create Category</h2>
            <p>Добавьте раздел, который будет отображён существующим Mobile catalog.</p>
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
            <h2>Create Product</h2>
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
            Product error: existing Categories are unavailable.
          </p>
        )}
      </section>
    </section>
  );
}
