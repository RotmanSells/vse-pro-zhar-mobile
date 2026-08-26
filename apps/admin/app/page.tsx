export default function AdminPage() {
  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Admin</h1>
          <p className="page-subtitle">Admin shell is ready.</p>
        </div>
        <span className="environment-badge">TEST ENVIRONMENT</span>
      </header>
      <section className="hero-card" aria-label="Admin visual direction">
        <div>
          <p className="hero-eyebrow">Все Про Жар / ADMIN</p>
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
