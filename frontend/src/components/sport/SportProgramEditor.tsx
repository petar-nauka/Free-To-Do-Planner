import { useEffect, useState } from 'react';
import { DAYS_FULL } from '@/lib/sportCycle';
import { cloneContent, freshSeedContent } from '@/lib/sportProgramSeed';
import type { SportContent, TrackKind } from '@/lib/sportTypes';

interface SportProgramEditorProps {
  content: SportContent;
  startDate: string;
  onSave: (content: SportContent, startDate: string) => void;
  isSaving: boolean;
}

const TRACK_OPTIONS: { value: TrackKind; label: string }[] = [
  { value: 'weight_reps', label: 'кг + повторения' },
  { value: 'reps', label: 'повторения' },
  { value: 'time', label: 'време' },
  { value: 'none', label: 'само отметка' },
];

const PATTERN_TAB = '__pattern__';

/**
 * Редакторът работи върху локално КОПИЕ на програмата и записва чак при „Запиши".
 * Така незавършено редактиране не сменя плана за деня под ръцете на човека.
 */
export function SportProgramEditor({
  content,
  startDate,
  onSave,
  isSaving,
}: SportProgramEditorProps) {
  const [draft, setDraft] = useState<SportContent>(() => cloneContent(content));
  const [draftStart, setDraftStart] = useState(startDate);
  const [tab, setTab] = useState<string>(PATTERN_TAB);
  const [dirty, setDirty] = useState(false);

  // Дойде ли нова версия отвън (след запис), тръгваме от нея.
  useEffect(() => {
    setDraft(cloneContent(content));
    setDraftStart(startDate);
    setDirty(false);
  }, [content, startDate]);

  const blockKeys = Object.keys(draft.blocks);
  const activeKey = tab !== PATTERN_TAB && draft.blocks[tab] ? tab : PATTERN_TAB;

  /** Всяка промяна минава оттук, за да не се забрави флагът „има незаписано". */
  const edit = (fn: (d: SportContent) => void) => {
    setDraft((prev) => {
      const next = cloneContent(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const removeBlockFromDay = (dayIndex: number, position: number) =>
    edit((d) => {
      d.week_pattern[dayIndex].blocks.splice(position, 1);
    });

  const moveBlockInDay = (dayIndex: number, position: number, direction: -1 | 1) =>
    edit((d) => {
      const arr = d.week_pattern[dayIndex].blocks;
      const target = position + direction;
      if (target < 0 || target >= arr.length) return;
      [arr[position], arr[target]] = [arr[target], arr[position]];
    });

  const addBlockToDay = (dayIndex: number, key: string) =>
    edit((d) => {
      d.week_pattern[dayIndex].blocks.push(key);
    });

  const addBlock = () => {
    const title = window.prompt('Име на новия блок (напр. Плуване, Колело, Йога):');
    if (!title?.trim()) return;
    const key = `b${Date.now().toString(36)}`;
    edit((d) => {
      d.blocks[key] = {
        title: title.trim(),
        detail: '',
        duration: '',
        exercises: [{ name: title.trim(), target: '', hint: '', track: 'time' }],
      };
    });
    setTab(key);
  };

  const deleteBlock = (key: string) => {
    const usedIn = draft.week_pattern.filter((p) => p.blocks.includes(key)).length;
    const message =
      `Изтриване на блока „${draft.blocks[key].title}"?` +
      (usedIn ? `\nПланиран е в ${usedIn} дни — ще бъде махнат и оттам.` : '') +
      '\nЗаписаните тренировки от миналото остават в историята.';
    if (!window.confirm(message)) return;

    edit((d) => {
      delete d.blocks[key];
      d.week_pattern.forEach((p) => {
        p.blocks = p.blocks.filter((k) => k !== key);
      });
    });
    setTab(PATTERN_TAB);
  };

  const resetToSeed = () => {
    if (!window.confirm('Връщане към оригиналната програма? Записаните тренировки остават.'))
      return;
    setDraft(freshSeedContent());
    setDirty(true);
    setTab(PATTERN_TAB);
  };

  return (
    <section className="section" style={{ borderTop: 0 }}>
      <div className="section-intro">
        <p className="eyebrow">Твоята програма</p>
        <h2>Редактор</h2>
        <p>
          Всяка сесия е <strong>блок</strong>. В „Седмичен ритъм" решаваш кои блокове има всеки
          ден — можеш да махнеш разходката в сряда, да я замениш с плуване в събота или да я
          премахнеш отвсякъде.
        </p>
      </div>

      {dirty && <p className="saved-flash">Има незаписани промени.</p>}

      <div className="editor-grid">
        <div className="editor-tabs">
          <button
            className={activeKey === PATTERN_TAB ? 'on' : undefined}
            onClick={() => setTab(PATTERN_TAB)}
          >
            Седмичен ритъм
          </button>
          <span className="sep">Блокове</span>
          {blockKeys.map((k) => (
            <button
              key={k}
              className={activeKey === k ? 'on' : undefined}
              onClick={() => setTab(k)}
            >
              {draft.blocks[k].title}
            </button>
          ))}
          <button className="add" onClick={addBlock}>
            + Нов блок
          </button>
        </div>

        <div>
          {activeKey === PATTERN_TAB ? (
            <>
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    color: '#607181',
                    fontSize: 10,
                    fontWeight: 850,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                  }}
                  htmlFor="sport-start-date"
                >
                  Начало на програмата (за броенето на цикли)
                </label>
                <input
                  id="sport-start-date"
                  type="date"
                  value={draftStart}
                  onChange={(e) => {
                    setDraftStart(e.target.value);
                    setDirty(true);
                  }}
                  style={{
                    minHeight: 42,
                    padding: '0 10px',
                    marginTop: 6,
                    border: '1px solid rgba(24,50,74,.17)',
                    background: '#fbf7ef',
                    fontSize: 13,
                    display: 'block',
                  }}
                />
              </div>

              {draft.week_pattern.map((day, dayIndex) => (
                <div className="day-row" key={DAYS_FULL[dayIndex]}>
                  <strong>
                    {DAYS_FULL[dayIndex]}
                    <small>{day.blocks.length ? `${day.blocks.length} сесии` : 'почивен ден'}</small>
                  </strong>
                  <div className="chips">
                    {day.blocks.map((key, position) => (
                      <span className="chip" key={`${key}-${position}`}>
                        {position > 0 && (
                          <button
                            className="move"
                            title="Нагоре"
                            onClick={() => moveBlockInDay(dayIndex, position, -1)}
                          >
                            ↑
                          </button>
                        )}
                        {position < day.blocks.length - 1 && (
                          <button
                            className="move"
                            title="Надолу"
                            onClick={() => moveBlockInDay(dayIndex, position, 1)}
                          >
                            ↓
                          </button>
                        )}
                        {draft.blocks[key]?.title ?? `${key} (липсва)`}
                        <button
                          title="Махни от този ден"
                          onClick={() => removeBlockFromDay(dayIndex, position)}
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    <select
                      value=""
                      aria-label={`Добави блок в ${DAYS_FULL[dayIndex]}`}
                      onChange={(e) => {
                        if (e.target.value) addBlockToDay(dayIndex, e.target.value);
                      }}
                    >
                      <option value="">+ добави блок…</option>
                      {blockKeys
                        .filter((k) => !day.blocks.includes(k))
                        .map((k) => (
                          <option key={k} value={k}>
                            {draft.blocks[k].title}
                          </option>
                        ))}
                    </select>

                    {day.blocks.length === 0 && <span className="rest-note">пълна почивка</span>}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="block-meta">
                <input
                  value={draft.blocks[activeKey].title}
                  placeholder="Име на блока"
                  onChange={(e) => edit((d) => { d.blocks[activeKey].title = e.target.value; })}
                />
                <input
                  value={draft.blocks[activeKey].duration ?? ''}
                  placeholder="Времетраене"
                  onChange={(e) => edit((d) => { d.blocks[activeKey].duration = e.target.value; })}
                />
              </div>
              <input
                value={draft.blocks[activeKey].detail ?? ''}
                placeholder="Кратко описание под името"
                onChange={(e) => edit((d) => { d.blocks[activeKey].detail = e.target.value; })}
                style={{
                  width: '100%',
                  minHeight: 40,
                  padding: '0 12px',
                  marginBottom: 18,
                  border: '1px solid rgba(24,50,74,.17)',
                  background: '#fbf7ef',
                  fontSize: 13,
                }}
              />

              <div className="ex-head">
                <span>Упражнение</span>
                <span>Цел</span>
                <span>Какво се записва</span>
                <span />
              </div>

              {draft.blocks[activeKey].exercises.map((ex, i) => (
                <div className="ex-row" key={i}>
                  <input
                    value={ex.name}
                    onChange={(e) =>
                      edit((d) => { d.blocks[activeKey].exercises[i].name = e.target.value; })
                    }
                  />
                  <input
                    value={ex.target}
                    onChange={(e) =>
                      edit((d) => { d.blocks[activeKey].exercises[i].target = e.target.value; })
                    }
                  />
                  <select
                    value={ex.track}
                    onChange={(e) =>
                      edit((d) => {
                        d.blocks[activeKey].exercises[i].track = e.target.value as TrackKind;
                      })
                    }
                  >
                    {TRACK_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="del"
                    title="Изтрий"
                    onClick={() =>
                      edit((d) => { d.blocks[activeKey].exercises.splice(i, 1); })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="editor-actions">
                <button
                  className="btn"
                  onClick={() =>
                    edit((d) => {
                      d.blocks[activeKey].exercises.push({
                        name: 'Ново упражнение',
                        target: '10–12 повторения',
                        hint: '',
                        track: 'reps',
                      });
                    })
                  }
                >
                  + Добави упражнение
                </button>
                <button className="btn danger" onClick={() => deleteBlock(activeKey)}>
                  Изтрий целия блок
                </button>
              </div>
            </>
          )}

          <div className="editor-actions">
            <button
              className="btn dark"
              onClick={() => onSave(draft, draftStart)}
              disabled={isSaving || !dirty}
            >
              {isSaving ? 'Записване…' : 'Запиши програмата'}
            </button>
            <button className="btn" onClick={resetToSeed}>
              Върни оригиналната програма
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
