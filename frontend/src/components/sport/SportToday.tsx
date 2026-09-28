import type { ReactNode } from 'react';
import {
  DAYS_FULL,
  cycleInfo,
  fullDaysInCycle,
  percent,
  plannedBlocks,
  rangeStats,
  todayISO,
  weekdayOf,
} from '@/lib/sportCycle';
import type { SportProgram, SportSession } from '@/lib/sportTypes';

interface SportTodayProps {
  program: SportProgram;
  sessions: SportSession[];
  selectedDate: string;
  viewCycle: number;
  openBlockKey: string | null;
  onToggleBlock: (blockKey: string) => void;
  onOpenBlock: (blockKey: string) => void;
  /** Дясната колона (календарът) — влиза в същия grid като плана за деня. */
  calendar: ReactNode;
}

/** Заглавната част и списъкът със сесиите за избрания ден. */
export function SportToday({
  program,
  sessions,
  selectedDate,
  viewCycle,
  openBlockKey,
  onToggleBlock,
  onOpenBlock,
  calendar,
}: SportTodayProps) {
  const { content, start_date: startDate, cycle_days: cycleDays } = program;
  const info = cycleInfo(selectedDate, startDate, cycleDays);

  if (info.beforeStart) {
    return (
      <section className="hero">
        <div>
          <p className="eyebrow">Програмата още не е започнала</p>
          <h1>Старт на {startDate}</h1>
        </div>
      </section>
    );
  }

  const blocks = plannedBlocks(content, selectedDate);
  const isToday = selectedDate === todayISO();
  const weekday = weekdayOf(selectedDate);

  const cycleStats = rangeStats(program, sessions, viewCycle, 1, cycleDays);
  const pct = percent(cycleStats);
  const fullDays = fullDaysInCycle(program, sessions, viewCycle);

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Четири седмици · ритъм, който се повтаря</p>
          <h1>{content.title}</h1>
          <p className="intro">
            Без гонене на съвършенство. Само ясен ритъм, спокойна техника и малки отметки,
            които се натрупват.
          </p>

          <div className="overall">
            <div className="progress-label">
              <span>Изпълнение · цикъл {viewCycle}</span>
              <strong>{pct}%</strong>
            </div>
            <div className="track">
              <i style={{ width: `${pct}%` }} />
            </div>
            <p>
              {cycleStats.done} от {cycleStats.total} планирани сесии · {fullDays} пълни дни ·
              цел: поне 80%
            </p>
          </div>
        </div>

        <aside className="hero-note">
          <span className="note-number">{String(info.dayInCycle).padStart(2, '0')}</span>
          <div>
            <p>Ден от цикъл {info.cycle}</p>
            <strong>{DAYS_FULL[weekday]}</strong>
            <span>
              Седмица {info.week} от {content.weeks.length || 4} ·{' '}
              {isToday ? 'днес' : selectedDate}
            </span>
          </div>
        </aside>
      </section>

      <section className="today-layout">
      <div className="daily-plan">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{isToday ? 'Днешният план' : 'Планът за избрания ден'}</p>
            <h2>
              {DAYS_FULL[weekday]}, ден {info.dayInCycle}
            </h2>
          </div>
          <span className="effort-badge">
            {blocks.length ? `${blocks.length} сесии` : 'почивен ден'}
          </span>
        </div>

        {blocks.length === 0 ? (
          <p className="empty-day">
            Този ден няма планирани сесии. Пълна почивка — това също е част от програмата.
            <br />
            Ако искаш да добавиш нещо, отвори <strong>Програма → Седмичен ритъм</strong>.
          </p>
        ) : (
          <div className="session-list">
            {blocks.map((b, i) => {
              const session = sessions.find(
                (s) => s.session_date === selectedDate && s.block_key === b.key,
              );
              const isDone = !!session?.completed;
              const logged = session?.entries?.length ?? 0;

              return (
                <article key={b.key} className={isDone ? 'session-card done' : 'session-card'}>
                  <span className="session-number">{String(i + 1).padStart(2, '0')}</span>
                  <div className="session-copy">
                    <h3>{b.title}</h3>
                    {b.detail && <p>{b.detail}</p>}
                    {logged > 0 && <span className="logged">{logged} записани числа</span>}
                  </div>
                  {b.duration && <span className="duration">{b.duration}</span>}
                  <div className="session-actions">
                    <button className="btn dark" onClick={() => onToggleBlock(b.key)}>
                      {isDone ? '✓ Готово' : 'Отметни'}
                    </button>
                    <button className="btn" onClick={() => onOpenBlock(b.key)}>
                      {openBlockKey === b.key ? 'Скрий' : 'Отвори'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

        {calendar}
      </section>
    </>
  );
}
