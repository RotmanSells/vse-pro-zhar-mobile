import { listCategoriesAction } from './menu/category-actions';
import { listProductsAction } from './menu/product-actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage(): Promise<React.ReactElement> {
  const [categoriesResult, productsResult] = await Promise.all([
    listCategoriesAction(),
    listProductsAction(),
  ]);
  const categories = categoriesResult.kind === 'loaded' ? categoriesResult.categories : undefined;
  const products = productsResult.kind === 'loaded' ? productsResult.products : undefined;
  const catalogAvailable = categories !== undefined && products !== undefined;
  const visibleProducts = products?.filter((product) => product.adminEnabled).length;
  const hiddenProducts = products?.filter((product) => !product.adminEnabled).length;

  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">ОБЗОР</p>
          <h1 className="page-title">Дашборд</h1>
          <p className="page-subtitle">Рабочая панель каталога «Все Про Жар»</p>
        </div>
        <span className="environment-badge">ТЕСТОВАЯ СРЕДА</span>
      </header>

      <section aria-label="Рабочая область каталога" className="hero-card">
        <div>
          <p className="hero-eyebrow">ВСЕ ПРО ЖАР / ADMIN</p>
          <h2>Меню под контролем</h2>
          <p>
            Категории, товары, цены и видимость приходят из нашего Backend. Операционные статусы
            кухни остаются на стороне iiko.
          </p>
        </div>
        <span aria-hidden="true" className="hero-illustration">
          🔥
        </span>
      </section>

      <section aria-label="Состояние аналитики" className="metric-grid">
        <DashboardMetric icon="💰" label="Выручка" value="—" note="Нет Backend-метрики" />
        <DashboardMetric icon="📦" label="Заказы" value="—" note="Нет Backend-метрики" />
        <DashboardMetric icon="🧾" label="Средний чек" value="—" note="Нет Backend-метрики" />
        <DashboardMetric icon="👥" label="Клиенты" value="—" note="Нет Backend-метрики" />
      </section>

      <div className="dashboard-grid">
        <section className="content-card analytics-placeholder">
          <header className="card-header">
            <div>
              <h2>Аналитика</h2>
              <p>
                Графики и бизнес-показатели появятся после подключения соответствующего Backend API.
              </p>
            </div>
            <span aria-hidden="true" className="card-icon">
              ◌
            </span>
          </header>
          <div className="placeholder-panel" role="status">
            <span aria-hidden="true" className="placeholder-panel-icon">
              ∿
            </span>
            <div>
              <strong>Данных пока нет</strong>
              <p>
                Здесь будут только значения, подтверждённые Backend. Тестовые показатели не
                подставляются.
              </p>
            </div>
          </div>
        </section>

        <section className="content-card catalog-snapshot">
          <header className="card-header">
            <div>
              <h2>Снимок каталога</h2>
              <p>Актуальные значения из Admin/Backend API.</p>
            </div>
            <span aria-hidden="true" className="card-icon">
              ♨
            </span>
          </header>
          <div className="snapshot-status" role="status">
            <span className={`status-dot${catalogAvailable ? ' status-dot-success' : ''}`} />
            {catalogAvailable ? 'Backend доступен' : 'Backend недоступен'}
          </div>
          <dl className="snapshot-list">
            <SnapshotRow label="Категории" value={formatCount(categories?.length)} />
            <SnapshotRow label="Всего товаров" value={formatCount(products?.length)} />
            <SnapshotRow label="В каталоге" value={formatCount(visibleProducts)} />
            <SnapshotRow label="Скрыто" value={formatCount(hiddenProducts)} />
          </dl>
          <a className="control-button control-button-secondary snapshot-link" href="/menu">
            Открыть меню <span aria-hidden="true">→</span>
          </a>
        </section>
      </div>
    </section>
  );
}

function DashboardMetric({
  icon,
  label,
  note,
  value,
}: {
  readonly icon: string;
  readonly label: string;
  readonly note: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <article className="metric-card">
      <span aria-hidden="true" className="metric-icon">
        {icon}
      </span>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-note">{note}</p>
    </article>
  );
}

function SnapshotRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <div className="snapshot-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatCount(value: number | undefined): string {
  return value === undefined ? '—' : String(value);
}
