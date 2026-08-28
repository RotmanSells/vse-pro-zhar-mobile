import { notFound } from 'next/navigation';

type SectionDefinition = {
  readonly eyebrow: string;
  readonly icon: string;
  readonly owner: string;
  readonly readOnly?: boolean;
  readonly subtitle: string;
  readonly title: string;
};

const SECTION_DEFINITIONS: Readonly<Record<string, SectionDefinition>> = {
  customers: {
    eyebrow: 'КЛИЕНТЫ',
    icon: '◎',
    owner: 'Backend',
    subtitle: 'Профиль, история и клиентская аналитика',
    title: 'Клиенты',
  },
  loyalty: {
    eyebrow: 'ЛОЯЛЬНОСТЬ',
    icon: '✦',
    owner: 'Backend',
    subtitle: 'Угольки, XP и настройки рангов',
    title: 'Лояльность',
  },
  messages: {
    eyebrow: 'РАССЫЛКИ',
    icon: '➤',
    owner: 'Backend + Push provider',
    subtitle: 'Кампании и сообщения клиентам',
    title: 'Рассылки',
  },
  orders: {
    eyebrow: 'ЗАКАЗЫ',
    icon: '▤',
    owner: 'Backend + iiko',
    readOnly: true,
    subtitle: 'Просмотр и диагностика заказов',
    title: 'Заказы',
  },
  promos: {
    eyebrow: 'ПРОМОКОДЫ',
    icon: '◇',
    owner: 'Backend',
    subtitle: 'Правила скидок и промо',
    title: 'Промокоды',
  },
  quests: {
    eyebrow: 'КВЕСТЫ',
    icon: '◉',
    owner: 'Backend',
    subtitle: 'Задания и награды для клиентов',
    title: 'Квесты',
  },
  segments: {
    eyebrow: 'СЕГМЕНТЫ',
    icon: '▦',
    owner: 'Backend',
    subtitle: 'Группы клиентов для аналитики и кампаний',
    title: 'Сегменты',
  },
  wheel: {
    eyebrow: 'КОЛЕСО',
    icon: '◌',
    owner: 'Backend',
    subtitle: 'Награды и правила колеса',
    title: 'Колесо',
  },
};

export default async function DeferredSectionPage({
  params,
}: {
  readonly params: Promise<{ section: string }>;
}): Promise<React.ReactElement> {
  const { section } = await params;
  const definition = SECTION_DEFINITIONS[section];
  if (definition === undefined) notFound();

  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{definition.eyebrow}</p>
          <h1 className="page-title">{definition.title}</h1>
          <p className="page-subtitle">{definition.subtitle}</p>
        </div>
        <span className="environment-badge">В РАЗРАБОТКЕ</span>
      </header>

      <section aria-label={`Состояние раздела ${definition.title}`} className="deferred-hero">
        <span aria-hidden="true" className="deferred-hero-icon">
          {definition.icon}
        </span>
        <div>
          <p className="hero-eyebrow">ТОЧКА ПОДКЛЮЧЕНИЯ</p>
          <h2>Раздел готов к Backend</h2>
          <p>{definition.subtitle}. Здесь появятся только данные из согласованного контракта.</p>
        </div>
      </section>

      <section className="content-card deferred-card">
        <header className="card-header">
          <div>
            <h2>Данные ещё не подключены</h2>
            <p>Runtime-данные не подставляются. Пока нет источника, экран остаётся пустым.</p>
          </div>
          <span aria-hidden="true" className="card-icon">
            …
          </span>
        </header>
        <div className="deferred-status-grid">
          <div className="deferred-status-row">
            <span>Источник данных</span>
            <strong>{definition.owner}</strong>
          </div>
          <div className="deferred-status-row">
            <span>Состояние</span>
            <strong className="deferred-status-pending">Ожидает контракт</strong>
          </div>
          {definition.readOnly ? (
            <div className="deferred-boundary-note" role="note">
              <strong>Только просмотр и диагностика</strong>
              <p>
                iiko владеет операционной доступностью, стоп-листом и кухонными статусами. Ручное
                изменение статуса заказа в Admin не отображается.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
