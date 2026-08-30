import type { CategoryResponse } from '../../../../packages/contracts/src/category';
import type { ProductResponse } from '../../../../packages/contracts/src/product';

import { createCategoryAction, listCategoriesAction } from './category-actions';
import { CategoryCreateForm } from './category-create-form';
import {
  createProductAction,
  listProductsAction,
  replaceProductImageAction,
  updateProductVisibilityAction,
  updateProductDetailsAction,
} from './product-actions';
import { ProductCreateForm } from './product-create-form';
import { ProductDetailsForm } from './product-details-form';

export const dynamic = 'force-dynamic';

export default async function MenuPage(): Promise<React.ReactElement> {
  const [categoriesResult, productsResult] = await Promise.all([
    listCategoriesAction(),
    listProductsAction(),
  ]);
  const categories = categoriesResult.kind === 'loaded' ? categoriesResult.categories : [];
  const products = productsResult.kind === 'loaded' ? productsResult.products : [];
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const categoriesLoaded = categoriesResult.kind === 'loaded';
  const productsLoaded = productsResult.kind === 'loaded';

  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">КАТАЛОГ</p>
          <h1 className="page-title">Меню</h1>
          <p className="page-subtitle">Категории и товары из нашего Backend</p>
        </div>
        <div className="header-actions">
          <a className="control-button control-button-secondary" href="#create-category">
            + Категория
          </a>
          <a className="control-button control-button-primary" href="#create-product">
            + Блюдо
          </a>
        </div>
      </header>

      <section aria-label="Состояние меню" className="catalog-metric-grid">
        <CatalogMetric
          icon="♨"
          label="Категории"
          value={categoriesLoaded ? categories.length : undefined}
        />
        <CatalogMetric
          icon="✦"
          label="Всего товаров"
          value={productsLoaded ? products.length : undefined}
        />
        <CatalogMetric
          icon="●"
          label="В каталоге"
          value={
            productsLoaded ? products.filter((product) => product.adminEnabled).length : undefined
          }
        />
        <CatalogMetric
          icon="○"
          label="Скрыто"
          value={
            productsLoaded ? products.filter((product) => !product.adminEnabled).length : undefined
          }
        />
      </section>

      <div className="menu-layout">
        <section className="content-card categories-card">
          <header className="card-header">
            <div>
              <h2>Категории</h2>
              <p>Сохранённые разделы, полученные из Backend.</p>
            </div>
            <span aria-hidden="true" className="card-icon">
              ♨
            </span>
          </header>
          {categoriesLoaded && categories.length > 0 ? (
            <ul className="category-list">
              {categories.map((category) => (
                <CategoryRow category={category} key={category.id} products={products} />
              ))}
            </ul>
          ) : (
            <BackendEmptyState
              message={
                categoriesLoaded
                  ? 'В Backend пока нет категорий.'
                  : 'Категории не удалось загрузить из Backend.'
              }
            />
          )}
          <details className="create-panel" id="create-category">
            <summary>Добавить категорию</summary>
            <CategoryCreateForm createCategory={createCategoryAction} />
          </details>
        </section>

        <section className="content-card product-create-card" id="create-product">
          <header className="card-header">
            <div>
              <h2>Новое блюдо</h2>
              <p>Создание проходит через текущий Admin → Backend boundary.</p>
            </div>
            <span aria-hidden="true" className="card-icon">
              ✦
            </span>
          </header>
          {categoriesLoaded && categories.length > 0 ? (
            <ProductCreateForm categories={categories} createProduct={createProductAction} />
          ) : (
            <BackendEmptyState
              message={
                categoriesLoaded
                  ? 'Сначала создайте категорию в Backend.'
                  : 'Форма появится после загрузки категорий из Backend.'
              }
            />
          )}
        </section>
      </div>

      <section className="content-card products-card">
        <header className="card-header products-card-header">
          <div>
            <h2>Товары</h2>
            <p>
              {productsLoaded
                ? `Backend вернул ${products.length} ${productWord(products.length)}.`
                : 'Список ожидает ответа Backend.'}
            </p>
          </div>
          <div className="backend-source-badge">
            <span className={`status-dot${productsLoaded ? ' status-dot-success' : ''}`} />
            {productsLoaded ? 'Backend' : 'Нет соединения'}
          </div>
        </header>
        {productsLoaded && products.length > 0 ? (
          <div className="product-card-grid">
            {products.map((product) => (
              <ProductCard
                categoryName={categoryNames.get(product.categoryId) ?? 'Категория'}
                key={product.id}
                product={product}
              />
            ))}
          </div>
        ) : (
          <BackendEmptyState
            message={
              productsLoaded
                ? 'В Backend пока нет товаров.'
                : 'Товары не удалось загрузить из Backend.'
            }
          />
        )}
      </section>

      <section className="content-card details-card">
        <header className="card-header">
          <div>
            <h2>Детали товаров</h2>
            <p>
              Описание, вес, метки, изображение и видимость — через подтверждённые Backend-операции.
            </p>
          </div>
          <span aria-hidden="true" className="card-icon">
            ✎
          </span>
        </header>
        {productsLoaded && products.length > 0 ? (
          <div className="product-details-list">
            {products.map((product) => (
              <ProductDetailsForm
                categoryName={categoryNames.get(product.categoryId) ?? 'Категория'}
                key={product.id}
                product={product}
                replaceProductImage={replaceProductImageAction}
                updateProductDetails={updateProductDetailsAction}
                updateProductVisibility={updateProductVisibilityAction}
              />
            ))}
          </div>
        ) : (
          <BackendEmptyState
            message={
              productsLoaded
                ? 'Детали появятся после создания товара в Backend.'
                : 'Детали товара появятся после загрузки данных из Backend.'
            }
          />
        )}
      </section>
    </section>
  );
}

function CatalogMetric({
  icon,
  label,
  value,
}: {
  readonly icon: string;
  readonly label: string;
  readonly value: number | undefined;
}): React.ReactElement {
  return (
    <article className="catalog-metric-card">
      <span aria-hidden="true" className="catalog-metric-icon">
        {icon}
      </span>
      <p>{label}</p>
      <strong>{value === undefined ? '—' : value}</strong>
    </article>
  );
}

function CategoryRow({
  category,
  products,
}: {
  readonly category: CategoryResponse;
  readonly products: readonly ProductResponse[];
}): React.ReactElement {
  const productCount = products.filter((product) => product.categoryId === category.id).length;
  return (
    <li className="category-row">
      <span aria-hidden="true" className="category-row-icon">
        ♨
      </span>
      <span className="category-row-copy">
        <strong>{category.name}</strong>
        <span>{productCount} товаров в Backend</span>
      </span>
      <span className="category-row-arrow" aria-hidden="true">
        →
      </span>
    </li>
  );
}

function ProductCard({
  categoryName,
  product,
}: {
  readonly categoryName: string;
  readonly product: ProductResponse;
}): React.ReactElement {
  return (
    <article className={`catalog-product-card${product.adminEnabled ? '' : ' is-hidden'}`}>
      <div aria-label={`Изображение товара ${product.name}`} className="catalog-product-image">
        <span aria-hidden="true">✦</span>
        <small>Изображение из Backend</small>
      </div>
      <div className="catalog-product-content">
        <div className="catalog-product-tags">
          {product.isNew ? <span className="product-tag product-tag-new">Новинка</span> : null}
          {product.isHit ? <span className="product-tag product-tag-hit">Хит</span> : null}
          <span
            className={`product-tag ${product.adminEnabled ? 'product-tag-visible' : 'product-tag-hidden'}`}
          >
            {product.adminEnabled ? 'В каталоге' : 'Скрыто'}
          </span>
        </div>
        <h3>{product.name}</h3>
        <p className="catalog-product-category">{categoryName}</p>
        <div className="catalog-product-footer">
          <strong>{formatPrice(product.basePriceMinor)}</strong>
          <span aria-hidden="true" className="catalog-product-link">
            →
          </span>
        </div>
      </div>
    </article>
  );
}

function BackendEmptyState({ message }: { readonly message: string }): React.ReactElement {
  return (
    <div className="backend-empty-state" role="status">
      <span aria-hidden="true" className="backend-empty-icon">
        ◌
      </span>
      <p>{message}</p>
    </div>
  );
}

function formatPrice(basePriceMinor: number): string {
  const rubles = Math.floor(basePriceMinor / 100).toLocaleString('ru-RU');
  const kopecks = String(basePriceMinor % 100).padStart(2, '0');
  return kopecks === '00' ? `${rubles} ₽` : `${rubles},${kopecks} ₽`;
}

function productWord(count: number): string {
  const remainder = count % 10;
  const remainderHundred = count % 100;
  if (remainder === 1 && remainderHundred !== 11) return 'товар';
  if (remainder >= 2 && remainder <= 4 && (remainderHundred < 12 || remainderHundred > 14)) {
    return 'товара';
  }
  return 'товаров';
}
