export interface NoteTemplate {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  title: string;
  titleEn: string;
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting',
    name: 'Бележки от среща',
    nameEn: 'Meeting Notes',
    icon: '🤝',
    title: 'Бележки от среща',
    titleEn: 'Meeting Notes',
    content: `<h2>📋 Дневен ред</h2>
<ul>
  <li>Точка 1</li>
  <li>Точка 2</li>
  <li>Точка 3</li>
</ul>

<h2>👥 Участници</h2>
<ul>
  <li>Участник 1</li>
  <li>Участник 2</li>
</ul>

<h2>📝 Бележки</h2>
<p></p>

<h2>✅ Решения и действия</h2>
<ul>
  <li><strong>Задача:</strong> — <em>Отговорник:</em> — <em>Срок:</em></li>
</ul>

<h2>📅 Следваща среща</h2>
<p>Дата: </p>`,
  },
  {
    id: 'standup',
    name: 'Daily Standup',
    nameEn: 'Daily Standup',
    icon: '🚀',
    title: 'Daily Standup',
    titleEn: 'Daily Standup',
    content: `<h2>✅ Какво направих вчера</h2>
<ul>
  <li></li>
</ul>

<h2>🎯 Какво ще правя днес</h2>
<ul>
  <li></li>
</ul>

<h2>🚧 Блокери / Проблеми</h2>
<ul>
  <li></li>
</ul>`,
  },
  {
    id: 'brainstorm',
    name: 'Брейнсторминг',
    nameEn: 'Brainstorm',
    icon: '💡',
    title: 'Брейнсторминг',
    titleEn: 'Brainstorm',
    content: `<h2>🎯 Тема / Проблем</h2>
<p></p>

<h2>💡 Идеи</h2>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>

<h2>⭐ Топ идеи</h2>
<ul>
  <li></li>
</ul>

<h2>📋 Следващи стъпки</h2>
<ul>
  <li></li>
</ul>`,
  },
  {
    id: 'retrospective',
    name: 'Ретроспектива',
    nameEn: 'Retrospective',
    icon: '🔄',
    title: 'Ретроспектива',
    titleEn: 'Retrospective',
    content: `<h2>😊 Какво мина добре</h2>
<ul>
  <li></li>
</ul>

<h2>😕 Какво може да се подобри</h2>
<ul>
  <li></li>
</ul>

<h2>🎯 Действия за подобрение</h2>
<ul>
  <li><strong>Действие:</strong> — <em>Отговорник:</em></li>
</ul>`,
  },
  {
    id: 'project-plan',
    name: 'План на проект',
    nameEn: 'Project Plan',
    icon: '📊',
    title: 'План на проект',
    titleEn: 'Project Plan',
    content: `<h2>🎯 Цел на проекта</h2>
<p></p>

<h2>📋 Обхват</h2>
<ul>
  <li></li>
</ul>

<h2>📅 Етапи и срокове</h2>
<ol>
  <li><strong>Етап 1:</strong> — Срок: </li>
  <li><strong>Етап 2:</strong> — Срок: </li>
  <li><strong>Етап 3:</strong> — Срок: </li>
</ol>

<h2>👥 Екип и отговорности</h2>
<ul>
  <li></li>
</ul>

<h2>⚠️ Рискове</h2>
<ul>
  <li></li>
</ul>`,
  },
];
