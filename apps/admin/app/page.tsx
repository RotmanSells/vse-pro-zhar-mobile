export default function AdminPage() {
  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">ОБЗОР</p>
          <h1>Админ-панель</h1>
          <p className="page-subtitle">Админ-панель готова к работе.</p>
        </div>
        <span className="environment-badge">ТЕСТОВАЯ СРЕДА</span>
      </header>
      <section className="hero-card" aria-label="Оформление админ-панели">
        <div>
          <p className="hero-eyebrow">Все Про Жар / АДМИН</p>
          <h2>Рабочая панель каталога</h2>
          <p>Управляйте существующими тестовыми данными в спокойном огненном интерфейсе.</p>
        </div>
        <span aria-hidden="true" className="hero-illustration">
          🔥
        </span>
      </section>
      <section className="empty-card">
        <span aria-hidden="true" className="empty-card-icon">
          ✦
        </span>
        <div>
          <h2>Сводка готова</h2>
          <p>Выберите раздел в боковой навигации, чтобы продолжить работу.</p>
        </div>
      </section>
    </section>
  );
}
