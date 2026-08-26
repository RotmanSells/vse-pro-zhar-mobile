import { createCategoryAction } from './category-actions';
import { CategoryCreateForm } from './category-create-form';

export default function MenuPage(): React.ReactElement {
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
    </section>
  );
}
