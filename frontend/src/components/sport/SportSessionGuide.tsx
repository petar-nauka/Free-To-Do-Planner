import { Fragment, useState } from 'react';
import { lastEntryFor } from '@/lib/sportCycle';
import type { SportBlock, SportSession, SportWeek } from '@/lib/sportTypes';

interface SportSessionGuideProps {
  block: SportBlock;
  blockKey: string;
  dayInCycle: number;
  /** Седмицата от прогресията — за бележката „подготовка". */
  week?: SportWeek;
  /** Показва ли се бележката за подготовка в този блок. */
  showPrep: boolean;
  session: SportSession | null;
  allSessions: SportSession[];
  dateIso: string;
  onSetValue: (exerciseName: string, field: 'weight' | 'reps' | 'time', value: number | null) => void;
  onSetNote: (note: string) => void;
  onToggleCompleted: () => void;
  onClose: () => void;
}

const UNIT_LABEL: Record<'weight' | 'reps' | 'time', string> = {
  weight: 'кг',
  reps: 'повт.',
  time: 'мин./сек.',
};

/** Кои полета показва упражнението според своя `track`. */
function fieldsFor(track: string): ('weight' | 'reps' | 'time')[] {
  if (track === 'weight_reps') return ['weight', 'reps'];
  if (track === 'reps') return ['reps'];
  if (track === 'time') return ['time'];
  return [];
}

export function SportSessionGuide({
  block,
  blockKey,
  dayInCycle,
  week,
  showPrep,
  session,
  allSessions,
  dateIso,
  onSetValue,
  onSetNote,
  onToggleCompleted,
  onClose,
}: SportSessionGuideProps) {
  // Компонентът се монтира наново при смяна на деня или блока (виж `key` в Sport.tsx),
  // затова началната стойност е достатъчна — не трябва useEffect за пресинхронизиране.
  const [note, setNote] = useState(session?.note ?? '');

  const valueOf = (exerciseName: string, field: 'weight' | 'reps' | 'time') => {
    const entry = session?.entries?.find((e) => e.name === exerciseName);
    const v = entry?.[field];
    return v == null ? '' : String(v);
  };

  const handleChange = (
    exerciseName: string,
    field: 'weight' | 'reps' | 'time',
    raw: string,
  ) => {
    const text = raw.trim().replace(',', '.');
    if (text === '') {
      onSetValue(exerciseName, field, null);
      return;
    }
    const n = Number(text);
    if (Number.isFinite(n)) onSetValue(exerciseName, field, n);
  };

  return (
    <section className="guide">
      <div className="guide-head">
        <div>
          <p className="eyebrow">Ден {dayInCycle} · стъпка по стъпка</p>
          <h2>{block.title}</h2>
        </div>
        <button className="btn ghost-light" onClick={onClose}>
          Затвори
        </button>
      </div>

      {showPrep && week?.prep && (
        <p className="prep-note">
          <strong>Подготовка за набиране — {week.label}:</strong> {week.prep}
        </p>
      )}

      <ol className="steps">
        {(block.exercises ?? []).map((ex, i) => {
          const fields = fieldsFor(ex.track);
          const prev = lastEntryFor(allSessions, ex.name, dateIso);
          const prevParts: string[] = [];
          if (prev?.weight != null) prevParts.push(`${prev.weight} кг`);
          if (prev?.reps != null) prevParts.push(`${prev.reps} повт.`);
          if (prev?.time != null) prevParts.push(String(prev.time));

          return (
            <li key={`${ex.name}-${i}`}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <strong>{ex.name}</strong>
                {ex.hint && <p>{ex.hint}</p>}
                {ex.target && <span className="target">{ex.target}</span>}
              </div>
              <div className="fields">
                {fields.length === 0 ? (
                  <span className="unit">без запис</span>
                ) : (
                  fields.map((f) => (
                    <Fragment key={f}>
                      <input
                        inputMode="decimal"
                        aria-label={`${ex.name} — ${UNIT_LABEL[f]}`}
                        defaultValue={valueOf(ex.name, f)}
                        placeholder="—"
                        onBlur={(e) => handleChange(ex.name, f, e.target.value)}
                      />
                      <span className="unit">{UNIT_LABEL[f]}</span>
                    </Fragment>
                  ))
                )}
                {fields.length > 0 && prevParts.length > 0 && (
                  <span className="hint-last">миналия път: {prevParts.join(' × ')}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <textarea
        className="note-field"
        placeholder="Бележка за сесията (по желание)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if (note !== (session?.note ?? '')) onSetNote(note);
        }}
      />

      <button className="primary" onClick={onToggleCompleted}>
        {session?.completed ? 'Отбележи като неприключено' : 'Приключих тази сесия'}
      </button>
    </section>
  );
}
