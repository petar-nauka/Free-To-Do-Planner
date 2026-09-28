import { useMemo, useState } from 'react';
import {
  cycleInfo,
  dateOf,
  exerciseHistory,
  percent,
  rangeStats,
  todayISO,
  trackedExerciseNames,
} from '@/lib/sportCycle';
import type { SportMeasurement, SportProgram, SportSession } from '@/lib/sportTypes';

interface SportProgressProps {
  program: SportProgram;
  sessions: SportSession[];
  measurements: SportMeasurement[];
  viewCycle: number;
  onSetMetric: (measuredOn: string, key: string, value: number | null) => void;
}

/** Колко точки показваме на графиката — колкото се четат на тесен екран. */
const MAX_POINTS = 14;

export function SportProgress({
  program,
  sessions,
  measurements,
  viewCycle,
  onSetMetric,
}: SportProgressProps) {
  const { content, start_date: startDate, cycle_days: cycleDays } = program;
  const current = cycleInfo(todayISO(), startDate, cycleDays);

  const names = useMemo(() => trackedExerciseNames(sessions), [sessions]);
  const [picked, setPicked] = useState<string | null>(null);
  const exercise = picked && names.includes(picked) ? picked : names[0] ?? null;

  const points = useMemo(
    () => (exercise ? exerciseHistory(sessions, exercise) : []),
    [sessions, exercise],
  );
  const shown = points.slice(-MAX_POINTS);
  const max = shown.length ? Math.max(...shown.map((p) => p.value)) : 0;

  /* Мерките се водят на началото на текущата седмица от цикъла. */
  const weekStart = dateOf(
    viewCycle,
    (current.week ? current.week - 1 : 0) * 7 + 1,
    startDate,
    cycleDays,
  );
  const currentMeasurement = measurements.find((m) => m.measured_on === weekStart);

  const history = measurements
    .filter((m) => Object.keys(m.metrics ?? {}).length > 0)
    .slice(0, 6);

  const handleMetric = (key: string, raw: string) => {
    const text = raw.trim().replace(',', '.');
    if (text === '') {
      onSetMetric(weekStart, key, null);
      return;
    }
    const n = Number(text);
    if (Number.isFinite(n)) onSetMetric(weekStart, key, n);
  };

  return (
    <section className="section" style={{ borderTop: 0 }}>
      <div className="section-intro">
        <p className="eyebrow">Постепенно, не наведнъж</p>
        <h2>Напредък през четирите седмици</h2>
        <p>Променят се само кръговете и трудността. Упражненията остават познати.</p>
      </div>

      <div className="week-cards">
        {content.weeks.map((w, i) => {
          const stats = rangeStats(program, sessions, viewCycle, i * 7 + 1, i * 7 + 7);
          const pct = percent(stats);
          const isCurrent = current.cycle === viewCycle && current.week === i + 1;
          return (
            <article key={w.label} className={isCurrent ? 'week-card current' : 'week-card'}>
              <header>
                <span>{w.label}</span>
                <strong>{pct}%</strong>
              </header>
              <h3>{w.goal}</h3>
              <div className="track sage">
                <i style={{ width: `${pct}%` }} />
              </div>
              <dl>
                <dt>Сила</dt>
                <dd>{w.strength}</dd>
                <dt>Разходки</dt>
                <dd>{w.walks}</dd>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="chart-block">
        <div className="panel">
          <h3>Прогрес по упражнение</h3>
          <p>Всички цикли, най-новото вдясно.</p>

          {names.length === 0 ? (
            <p className="empty">
              Още няма записани числа.
              <br />
              Отвори сесия и попълни килограми или повторения.
            </p>
          ) : (
            <>
              <select
                value={exercise ?? ''}
                onChange={(e) => setPicked(e.target.value)}
                aria-label="Избор на упражнение"
              >
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              {shown.length === 0 ? (
                <p className="empty">Няма числа за това упражнение.</p>
              ) : (
                <>
                  <div className="chart">
                    {shown.map((p, i) => (
                      <div className="col" key={`${p.date}-${i}`}>
                        <b>{p.value}</b>
                        <i style={{ height: `${Math.max(6, Math.round((p.value / max) * 100))}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="chart-foot">
                    <span>{shown[0].date}</span>
                    <span>
                      {shown.length} сесии · от {points[0].value} до{' '}
                      {points[points.length - 1].value}
                    </span>
                    <span>{shown[shown.length - 1].date}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <h3>Четири числа, нищо повече</h3>
          <p>Гледай тенденцията, не огледалото след седем дни.</p>

          <div className="measure-form">
            {content.measures.map((m) => (
              <label key={m.key}>
                {m.label} <span>{m.unit}</span>
                <input
                  inputMode="decimal"
                  defaultValue={
                    currentMeasurement?.metrics?.[m.key] == null
                      ? ''
                      : String(currentMeasurement.metrics[m.key])
                  }
                  placeholder="—"
                  key={`${weekStart}-${m.key}`}
                  onBlur={(e) => handleMetric(m.key, e.target.value)}
                />
              </label>
            ))}
          </div>

          {history.length > 0 && (
            <div className="measure-hist">
              {history.map((m) => (
                <div key={m.measured_on}>
                  <span>{m.measured_on}</span>
                  <span style={{ color: '#18324a' }}>
                    {content.measures
                      .filter((x) => m.metrics?.[x.key] != null)
                      .map((x) => `${m.metrics[x.key]} ${x.unit}`)
                      .join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
