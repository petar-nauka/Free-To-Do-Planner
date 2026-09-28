import {
  DAYS_SHORT,
  addDays,
  cycleInfo,
  dateOf,
  dayStats,
  todayISO,
  weekdayOf,
} from '@/lib/sportCycle';
import type { SportProgram, SportSession } from '@/lib/sportTypes';

interface SportCycleCalendarProps {
  program: SportProgram;
  sessions: SportSession[];
  selectedDate: string;
  viewCycle: number;
  maxCycle: number;
  onSelectDate: (dateIso: string) => void;
  onChangeCycle: (cycle: number) => void;
  onRestartCycle: () => void;
}

/**
 * Дясната колона: лентата на текущата календарна седмица + решетката на цикъла.
 *
 * Решетката се подравнява по реалните дни от седмицата — ако цикълът не започва в
 * понеделник, отпред стоят празни клетки. Иначе колоната „Пн" щеше да лъже.
 */
export function SportCycleCalendar({
  program,
  sessions,
  selectedDate,
  viewCycle,
  maxCycle,
  onSelectDate,
  onChangeCycle,
  onRestartCycle,
}: SportCycleCalendarProps) {
  const today = todayISO();
  const { content, start_date: startDate, cycle_days: cycleDays } = program;

  const monday = addDays(selectedDate, -weekdayOf(selectedDate));
  const cycleStart = dateOf(viewCycle, 1, startDate, cycleDays);
  const pad = weekdayOf(cycleStart);

  return (
    <aside className="side">
      <div className="cycle-nav">
        <button
          onClick={() => onChangeCycle(viewCycle - 1)}
          disabled={viewCycle <= 1}
          aria-label="Предишен цикъл"
        >
          ‹
        </button>
        <strong>
          Цикъл {viewCycle} от {maxCycle}
        </strong>
        <button
          onClick={() => onChangeCycle(viewCycle + 1)}
          disabled={viewCycle >= maxCycle}
          aria-label="Следващ цикъл"
        >
          ›
        </button>
      </div>

      <div className="week-strip" aria-label="Дни от седмицата">
        {DAYS_SHORT.map((label, i) => {
          const iso = addDays(monday, i);
          const st = dayStats(content, sessions, iso);
          const info = cycleInfo(iso, startDate, cycleDays);
          return (
            <button
              key={iso}
              className={iso === selectedDate ? 'week-day active' : 'week-day'}
              onClick={() => onSelectDate(iso)}
              aria-pressed={iso === selectedDate}
            >
              <span>{label}</span>
              <strong>{info.beforeStart ? '–' : info.dayInCycle}</strong>
              <i>{st.total ? `${st.done}/${st.total}` : '—'}</i>
            </button>
          );
        })}
      </div>

      <div className="month-card">
        <div className="month-card-head">
          <h3>
            Цикъл {viewCycle} · {cycleDays} дни
          </h3>
          <span>Избери ден</span>
        </div>
        <div className="month-grid">
          {DAYS_SHORT.map((d) => (
            <b key={d}>{d}</b>
          ))}
          {Array.from({ length: pad }, (_, i) => (
            <span key={`pad-${i}`} className="date-button blank" />
          ))}
          {Array.from({ length: cycleDays }, (_, i) => i + 1).map((d) => {
            const iso = dateOf(viewCycle, d, startDate, cycleDays);
            const st = dayStats(content, sessions, iso);
            const classes = ['date-button'];
            if (st.total === 0) classes.push('rest');
            else if (st.done === st.total) classes.push('complete');
            else if (st.done > 0) classes.push('partial');
            if (iso > today) classes.push('future');
            if (iso === selectedDate) classes.push('selected');

            return (
              <button
                key={iso}
                className={classes.join(' ')}
                onClick={() => onSelectDate(iso)}
                title={`${iso} · ${st.done}/${st.total}`}
                aria-label={`Ден ${d}, ${st.done} от ${st.total} сесии`}
              >
                {st.total > 0 && st.done === st.total ? '✓' : d}
              </button>
            );
          })}
        </div>
      </div>

      <blockquote className="rule-quote">
        <small>Правилото, което пази ритъма</small>
        <p>{content.rule}</p>
      </blockquote>

      <button className="btn restart" onClick={onRestartCycle}>
        Започни нов цикъл от днес
      </button>
    </aside>
  );
}
