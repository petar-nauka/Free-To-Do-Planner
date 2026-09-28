import { useState } from 'react';
import {
  addDays,
  blockBreakdown,
  formatWeekRange,
  lastMeasurementIn,
  percent,
  periodStats,
  todayISO,
  weekStartOf,
  weeklyHistory,
} from '@/lib/sportCycle';
import type { SportMeasurement, SportProgram, SportSession } from '@/lib/sportTypes';

interface SportWeekSummaryProps {
  program: SportProgram;
  sessions: SportSession[];
  measurements: SportMeasurement[];
}

/** Колко седмици назад показва таблицата с историята. */
const HISTORY_WEEKS = 8;

/** Разликата в процентни пунктове, оцветена и с посока. */
function Delta({ value, unit = ' пункта', invert = false }: {
  value: number;
  unit?: string;
  /** true, когато по-малко е по-добре (тегло, обиколки). */
  invert?: boolean;
}) {
  if (value === 0) return <em className="delta flat">без промяна</em>;
  const better = invert ? value < 0 : value > 0;
  const rounded = Math.round(value * 10) / 10;
  return (
    <em className={better ? 'delta up' : 'delta down'}>
      {value > 0 ? '▲ +' : '▼ '}
      {rounded}
      {unit}
    </em>
  );
}

export function SportWeekSummary({ program, sessions, measurements }: SportWeekSummaryProps) {
  const { content, start_date: startDate } = program;
  const thisMonday = weekStartOf(todayISO());
  const [monday, setMonday] = useState(thisMonday);

  const sunday = addDays(monday, 6);
  const prevMonday = addDays(monday, -7);
  const prevSunday = addDays(monday, -1);

  const current = periodStats(content, sessions, monday, sunday);
  const previous = periodStats(content, sessions, prevMonday, prevSunday);

  const currentPct = percent(current);
  const previousPct = percent(previous);

  const breakdown = blockBreakdown(content, sessions, monday, sunday);
  const prevBreakdown = blockBreakdown(content, sessions, prevMonday, prevSunday);
  const prevByKey = Object.fromEntries(prevBreakdown.map((r) => [r.key, r]));

  const measureNow = lastMeasurementIn(measurements, monday, sunday);
  const measureBefore = lastMeasurementIn(measurements, prevMonday, prevSunday);

  const history = weeklyHistory(content, sessions, monday, startDate, HISTORY_WEEKS);

  const isThisWeek = monday === thisMonday;
  const canGoBack = monday > weekStartOf(startDate);

  return (
    <section className="section" style={{ borderTop: 0 }}>
      <div className="section-intro">
        <p className="eyebrow">Обобщение</p>
        <h2>Седмица по седмица</h2>
        <p>Сравнението е с предходната седмица. Почивните дни не се броят за пропуснати.</p>
      </div>

      <div className="period-nav">
        <button
          className="btn"
          onClick={() => setMonday(prevMonday)}
          disabled={!canGoBack}
          aria-label="Предишна седмица"
        >
          ‹ Предишна
        </button>
        <div className="period-title">
          <strong>{formatWeekRange(monday)}</strong>
          <span>{isThisWeek ? 'текущата седмица' : `спрямо ${formatWeekRange(prevMonday)}`}</span>
        </div>
        <button
          className="btn"
          onClick={() => setMonday(addDays(monday, 7))}
          disabled={isThisWeek}
          aria-label="Следваща седмица"
        >
          Следваща ›
        </button>
        {!isThisWeek && (
          <button className="btn dark" onClick={() => setMonday(thisMonday)}>
            Към тази седмица
          </button>
        )}
      </div>

      {/* --- трите основни числа --- */}
      <div className="stat-row">
        <article className="stat">
          <span className="stat-label">Изпълнение</span>
          <strong className="stat-value">{currentPct}%</strong>
          <p>
            {current.done} от {current.total} сесии
          </p>
          <Delta value={currentPct - previousPct} />
        </article>

        <article className="stat">
          <span className="stat-label">Пълни дни</span>
          <strong className="stat-value">
            {current.fullDays}
            <small> / {current.activeDays}</small>
          </strong>
          <p>дни, изкарани докрай</p>
          <Delta value={current.fullDays - previous.fullDays} unit=" дни" />
        </article>

        <article className="stat">
          <span className="stat-label">Пропуснати сесии</span>
          <strong className="stat-value">{current.total - current.done}</strong>
          <p>от планираните за седмицата</p>
          <Delta
            value={(current.total - current.done) - (previous.total - previous.done)}
            unit=""
            invert
          />
        </article>
      </div>

      <div className="summary-grid">
        {/* --- разбивка по блокове --- */}
        <div className="panel">
          <h3>Кое се получава и кое не</h3>
          <p>Подредени с най-пропусканото отгоре.</p>

          {breakdown.length === 0 ? (
            <p className="empty">Тази седмица няма планирани сесии.</p>
          ) : (
            <div className="breakdown">
              {breakdown.map((row) => {
                const pct = Math.round((row.done / row.total) * 100);
                const before = prevByKey[row.key];
                const beforePct = before ? Math.round((before.done / before.total) * 100) : null;
                return (
                  <div className="breakdown-row" key={row.key}>
                    <div className="breakdown-head">
                      <strong>{row.title}</strong>
                      <span>
                        {row.done}/{row.total}
                        {beforePct !== null && (
                          <i>
                            {' '}
                            (преди {before.done}/{before.total})
                          </i>
                        )}
                      </span>
                    </div>
                    <div className="track sage">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- мерки --- */}
        <div className="panel">
          <h3>Мерки</h3>
          <p>Последният запис в седмицата, сравнен с предходната.</p>

          {!measureNow ? (
            <p className="empty">
              Няма въведени мерки за тази седмица.
              <br />
              Попълни ги в „Четири числа, нищо повече" по-долу.
            </p>
          ) : (
            <div className="measure-delta">
              {content.measures
                .filter((m) => measureNow.metrics[m.key] != null)
                .map((m) => {
                  const now = measureNow.metrics[m.key];
                  const before = measureBefore?.metrics?.[m.key];
                  // За тегло и обиколки по-малко е по-добре; за брой тренировки и висене — повече.
                  const lessIsBetter = m.key === 'weight' || m.key === 'waist';
                  return (
                    <div key={m.key}>
                      <span>{m.label}</span>
                      <strong>
                        {now} {m.unit}
                      </strong>
                      {before != null ? (
                        <Delta value={now - before} unit={` ${m.unit}`} invert={lessIsBetter} />
                      ) : (
                        <em className="delta flat">първи запис</em>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* --- история по седмици --- */}
      <div className="panel history">
        <h3>История по седмици</h3>
        <p>Последните {history.length} седмици от началото на програмата. Кликни, за да отвориш.</p>

        <div className="history-rows">
          {history.map((row) => {
            const pct = percent(row.stats);
            const active = row.monday === monday;
            return (
              <button
                key={row.monday}
                className={active ? 'history-row active' : 'history-row'}
                onClick={() => setMonday(row.monday)}
              >
                <span className="hr-week">
                  {formatWeekRange(row.monday)}
                  {row.monday === thisMonday && <i> · тази седмица</i>}
                </span>
                <span className="hr-bar">
                  <span className="track sage">
                    <i style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className="hr-num">{pct}%</span>
                <span className="hr-meta">
                  {row.stats.done}/{row.stats.total} · {row.stats.fullDays} пълни
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
