import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSportProgram } from '@/hooks/useSportProgram';
import { useSportSessions } from '@/hooks/useSportSessions';
import { useSportMeasurements } from '@/hooks/useSportMeasurements';
import { cycleInfo, dateOf, todayISO } from '@/lib/sportCycle';
import type { SportContent } from '@/lib/sportTypes';
import { SportOffScreen } from '@/components/sport/SportOffScreen';
import { SportToday } from '@/components/sport/SportToday';
import { SportCycleCalendar } from '@/components/sport/SportCycleCalendar';
import { SportSessionGuide } from '@/components/sport/SportSessionGuide';
import { SportWeekSummary } from '@/components/sport/SportWeekSummary';
import { SportProgress } from '@/components/sport/SportProgress';
import { SportProgramEditor } from '@/components/sport/SportProgramEditor';
import { SportRules } from '@/components/sport/SportRules';
import '@/components/sport/sport.css';

type View = 'today' | 'progress' | 'program' | 'rules';

const NAV: { id: View; label: string }[] = [
  { id: 'today', label: 'Днес' },
  { id: 'progress', label: 'Напредък' },
  { id: 'program', label: 'Програма' },
  { id: 'rules', label: 'Правила' },
];

export default function Sport() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const {
    program,
    isEnabled,
    isLoading: programLoading,
    enableSport,
    isToggling,
    updateContent,
    setStartDate,
  } = useSportProgram();

  const { sessions, toggleCompleted, setEntryValue, setNote } = useSportSessions(program?.id);
  const { measurements, setMetric } = useSportMeasurements();

  const [view, setView] = useState<View>('today');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [viewCycle, setViewCycle] = useState(1);
  const [openBlockKey, setOpenBlockKey] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  // Щом програмата се зареди (или ѝ се смени началото), показваме текущия ѝ цикъл.
  const programStart = program?.start_date;
  const programCycleDays = program?.cycle_days;
  useEffect(() => {
    if (!programStart) return;
    setViewCycle(cycleInfo(todayISO(), programStart, programCycleDays).cycle || 1);
  }, [programStart, programCycleDays]);

  if (authLoading || programLoading) {
    return (
      <div className="sport-page">
        <main className="shell">
          <div className="daily-plan">
            <p className="empty-day">Зареждане…</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isEnabled || !program) {
    return (
      <div className="sport-page">
        <main className="shell">
          <SportOffScreen
            hasSavedData={sessions.length > 0}
            onEnable={() => enableSport()}
            isEnabling={isToggling}
          />
        </main>
      </div>
    );
  }

  const currentCycle = cycleInfo(todayISO(), program.start_date, program.cycle_days).cycle || 1;
  const maxCycle = Math.max(1, currentCycle);
  const info = cycleInfo(selectedDate, program.start_date, program.cycle_days);
  const openBlock = openBlockKey ? program.content.blocks[openBlockKey] : null;
  const week = program.content.weeks[info.week - 1];

  const handleSelectDate = (iso: string) => {
    setSelectedDate(iso);
    setOpenBlockKey(null);
    const next = cycleInfo(iso, program.start_date, program.cycle_days);
    if (!next.beforeStart) setViewCycle(next.cycle);
  };

  const handleChangeCycle = (cycle: number) => {
    if (cycle < 1 || cycle > maxCycle) return;
    setViewCycle(cycle);
    setSelectedDate(dateOf(cycle, 1, program.start_date, program.cycle_days));
    setOpenBlockKey(null);
  };

  const handleRestartCycle = () => {
    if (!window.confirm('Нов цикъл от днес? Старите записи остават непокътнати.')) return;
    setStartDate(todayISO());
    setSelectedDate(todayISO());
    setViewCycle(1);
    setOpenBlockKey(null);
  };

  const handleSaveProgram = (content: SportContent, startDate: string) => {
    updateContent(content);
    if (startDate !== program.start_date) setStartDate(startDate);
  };

  return (
    <div className="sport-page">
      <main className="shell">
        <header className="masthead">
          <div className="brand-col">
            <a
              className="back-link"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
            >
              ‹ Проекти / Задачи
            </a>
            <div className="brand">
              <span className="brand-mark">Д</span>
              <span>Дневник за движение</span>
            </div>
          </div>

          <nav className="mainnav" aria-label="Раздели на дневника">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={view === n.id ? 'on' : undefined}
                onClick={() => setView(n.id)}
                aria-pressed={view === n.id}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="edition">
            Лично издание
            <strong>Цикъл {currentCycle}</strong>
          </div>
        </header>

        {view === 'today' && (
          <>
            <SportToday
              program={program}
              sessions={sessions}
              selectedDate={selectedDate}
              viewCycle={viewCycle}
              openBlockKey={openBlockKey}
              onToggleBlock={(key) => toggleCompleted(selectedDate, key)}
              onOpenBlock={(key) => setOpenBlockKey(openBlockKey === key ? null : key)}
              calendar={
                <SportCycleCalendar
                  program={program}
                  sessions={sessions}
                  selectedDate={selectedDate}
                  viewCycle={viewCycle}
                  maxCycle={maxCycle}
                  onSelectDate={handleSelectDate}
                  onChangeCycle={handleChangeCycle}
                  onRestartCycle={handleRestartCycle}
                />
              }
            />

            {openBlock && openBlockKey && (
              <SportSessionGuide
                key={`${selectedDate}-${openBlockKey}`}
                block={openBlock}
                blockKey={openBlockKey}
                dayInCycle={info.dayInCycle}
                week={week}
                showPrep={openBlockKey === program.content.prep_block}
                session={
                  sessions.find(
                    (s) => s.session_date === selectedDate && s.block_key === openBlockKey,
                  ) ?? null
                }
                allSessions={sessions}
                dateIso={selectedDate}
                onSetValue={(name, field, value) =>
                  setEntryValue(selectedDate, openBlockKey, name, field, value)
                }
                onSetNote={(note) => setNote(selectedDate, openBlockKey, note)}
                onToggleCompleted={() => {
                  toggleCompleted(selectedDate, openBlockKey);
                  setOpenBlockKey(null);
                }}
                onClose={() => setOpenBlockKey(null)}
              />
            )}
          </>
        )}

        {view === 'progress' && (
          <>
            <SportWeekSummary
              program={program}
              sessions={sessions}
              measurements={measurements}
            />
            <SportProgress
              program={program}
              sessions={sessions}
              measurements={measurements}
              viewCycle={viewCycle}
              onSetMetric={(measuredOn, key, value) => setMetric({ measuredOn, key, value })}
            />
          </>
        )}

        {view === 'program' && (
          <SportProgramEditor
            content={program.content}
            startDate={program.start_date}
            onSave={handleSaveProgram}
            isSaving={isToggling}
          />
        )}

        {view === 'rules' && <SportRules content={program.content} />}

        <footer className="foot">
          <span>Дневник за движение</span>
          <span>80% постоянство е по-добро от 100% съвършенство за три дни.</span>
        </footer>
      </main>
    </div>
  );
}
