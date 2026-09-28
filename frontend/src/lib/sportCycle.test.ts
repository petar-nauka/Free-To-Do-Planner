import { describe, it, expect } from 'vitest';
import {
  addDays,
  blockBreakdown,
  cycleInfo,
  dateOf,
  dayStats,
  daysBetween,
  exerciseHistory,
  formatWeekRange,
  fullDaysInCycle,
  lastEntryFor,
  lastMeasurementIn,
  percent,
  periodStats,
  plannedBlocks,
  rangeStats,
  toISO,
  trackedExerciseNames,
  weekStartOf,
  weekdayOf,
  weeklyHistory,
} from './sportCycle';
import type { SportContent, SportProgram, SportSession } from './sportTypes';

/** 2026-08-01 е СЪБОТА — нарочно не понеделник, за да лови подравняването. */
const START = '2026-08-01';

const content = {
  version: 1,
  title: 'Тест',
  rule: '',
  blocks: {
    morning: { title: 'Сутрешна рутина', exercises: [] },
    A: { title: 'Тренировка А', exercises: [] },
    walk: { title: 'Разходка', exercises: [] },
  },
  week_pattern: [
    { blocks: ['morning', 'A', 'walk'] }, // Пн
    { blocks: ['morning', 'walk'] },      // Вт
    { blocks: [] },                       // Ср — почивен ден
    { blocks: ['morning', 'A'] },         // Чт
    { blocks: ['morning', 'walk'] },      // Пт
    { blocks: ['morning'] },              // Сб
    { blocks: ['walk', 'nema-go'] },      // Нд — един несъществуващ ключ
  ],
  weeks: [],
  rules: [],
  safety: { h: '', p: '' },
  measures: [],
} as unknown as SportContent;

const program = {
  id: 'p1',
  user_id: 'u1',
  name: 'Тест',
  start_date: START,
  cycle_days: 28,
  content,
  is_active: true,
} as SportProgram;

function session(dateIso: string, blockKey: string, completed = true, entries: unknown[] = []) {
  return {
    id: `${dateIso}-${blockKey}`,
    user_id: 'u1',
    program_id: 'p1',
    session_date: dateIso,
    block_key: blockKey,
    completed,
    completed_at: null,
    entries,
    note: null,
  } as unknown as SportSession;
}

describe('дати', () => {
  it('toISO работи в местно време, без изместване през UTC', () => {
    expect(toISO(new Date(2026, 7, 1))).toBe('2026-08-01');
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('addDays минава границите на месеца и годината', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('daysBetween не се чупи при смяната на лятно/зимно време', () => {
    // последната неделя на октомври 2026 — денонощието е 25 часа
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3);
    expect(daysBetween('2026-03-27', '2026-03-30')).toBe(3);
  });
});

describe('weekdayOf', () => {
  it('връща понеделник = 0 … неделя = 6', () => {
    expect(weekdayOf('2026-08-03')).toBe(0); // понеделник
    expect(weekdayOf('2026-08-04')).toBe(1);
    expect(weekdayOf('2026-08-08')).toBe(5); // събота
    expect(weekdayOf('2026-08-09')).toBe(6); // неделя
  });

  it('стартът на програмата пази реалния си ден (събота), не се смята за понеделник', () => {
    expect(weekdayOf(START)).toBe(5);
    expect(weekdayOf(dateOf(1, 1, START))).toBe(5);
  });

  it('остава верен през смяната на часа', () => {
    expect(weekdayOf('2026-10-26')).toBe(0);
  });
});

describe('cycleInfo', () => {
  it('денят на старта е ден 1 от цикъл 1, седмица 1', () => {
    const i = cycleInfo(START, START);
    expect(i).toMatchObject({ beforeStart: false, dayIndex: 1, cycle: 1, dayInCycle: 1, week: 1 });
  });

  it('седмицата се сменя на ден 8, не на ден 7', () => {
    expect(cycleInfo('2026-08-07', START).week).toBe(1);
    expect(cycleInfo('2026-08-08', START).week).toBe(2);
  });

  it('ден 28 е последният от цикъл 1, ден 29 отваря цикъл 2', () => {
    expect(cycleInfo('2026-08-28', START)).toMatchObject({ cycle: 1, dayInCycle: 28, week: 4 });
    expect(cycleInfo('2026-08-29', START)).toMatchObject({ cycle: 2, dayInCycle: 1, week: 1 });
  });

  it('цикъл 3 започва на ден 57', () => {
    expect(cycleInfo('2026-09-25', START).cycle).toBe(2); // ден 56
    expect(cycleInfo('2026-09-26', START)).toMatchObject({ cycle: 3, dayInCycle: 1 });
  });

  it('разпознава дати преди старта, без да смята боклук', () => {
    const i = cycleInfo('2026-07-20', START);
    expect(i.beforeStart).toBe(true);
    expect(i.cycle).toBe(0);
  });

  it('уважава различна дължина на цикъла', () => {
    expect(cycleInfo('2026-08-08', START, 7)).toMatchObject({ cycle: 2, dayInCycle: 1 });
  });
});

describe('dateOf', () => {
  it('е обратното на cycleInfo за 112 последователни дни', () => {
    for (let c = 1; c <= 4; c++) {
      for (let d = 1; d <= 28; d++) {
        const info = cycleInfo(dateOf(c, d, START), START);
        expect([info.cycle, info.dayInCycle]).toEqual([c, d]);
      }
    }
  });

  it('пресмята началата на циклите', () => {
    expect(dateOf(1, 1, START)).toBe('2026-08-01');
    expect(dateOf(2, 1, START)).toBe('2026-08-29');
    expect(dateOf(3, 14, START)).toBe('2026-10-09');
  });
});

describe('plannedBlocks', () => {
  it('връща блоковете по реалния ден от седмицата', () => {
    expect(plannedBlocks(content, '2026-08-03').map((b) => b.key)).toEqual(['morning', 'A', 'walk']);
    expect(plannedBlocks(content, '2026-08-04').map((b) => b.key)).toEqual(['morning', 'walk']);
  });

  it('връща празен списък за почивен ден', () => {
    expect(plannedBlocks(content, '2026-08-05')).toEqual([]); // сряда
  });

  it('пропуска тихо ключ на изтрит блок', () => {
    expect(plannedBlocks(content, '2026-08-09').map((b) => b.key)).toEqual(['walk']); // неделя
  });

  it('шаблонът се повтаря на всеки 7 дни, включително през граница на цикъл', () => {
    for (let d = 0; d < 60; d++) {
      const iso = addDays(START, d);
      expect(plannedBlocks(content, iso).map((b) => b.key))
        .toEqual(plannedBlocks(content, addDays(iso, 7)).map((b) => b.key));
    }
  });
});

describe('dayStats', () => {
  const monday = '2026-08-03'; // 3 планирани блока

  it('брои само отметнатите планирани блокове', () => {
    const sessions = [session(monday, 'morning'), session(monday, 'walk', false)];
    expect(dayStats(content, sessions, monday)).toEqual({ done: 1, total: 3 });
  });

  it('почивният ден е 0/0, а не пропуснат ден', () => {
    expect(dayStats(content, [], '2026-08-05')).toEqual({ done: 0, total: 0 });
    expect(percent(dayStats(content, [], '2026-08-05'))).toBe(0);
  });

  it('игнорира сесия за блок, който не е планиран този ден', () => {
    // вторник няма блок "A"
    expect(dayStats(content, [session('2026-08-04', 'A')], '2026-08-04')).toEqual({ done: 0, total: 2 });
  });
});

describe('rangeStats и fullDaysInCycle', () => {
  it('сумира изпълнението за диапазон дни', () => {
    const mon = '2026-08-03';
    const sessions = [session(mon, 'morning'), session(mon, 'A'), session(mon, 'walk')];
    // дни 3–4 от цикъла = 3 и 4 август (пн и вт) → 3 + 2 планирани
    expect(rangeStats(program, sessions, 1, 3, 4)).toEqual({ done: 3, total: 5 });
  });

  it('брои за пълен само ден с изпълнени всички планирани блокове', () => {
    const mon = '2026-08-03';
    const partial = [session(mon, 'morning'), session(mon, 'A')];
    expect(fullDaysInCycle(program, partial, 1)).toBe(0);
    expect(fullDaysInCycle(program, [...partial, session(mon, 'walk')], 1)).toBe(1);
  });

  it('не брои почивните дни за пълни', () => {
    expect(fullDaysInCycle(program, [], 1)).toBe(0);
  });
});

describe('percent', () => {
  it('закръгля и не дели на нула', () => {
    expect(percent({ done: 1, total: 3 })).toBe(33);
    expect(percent({ done: 3, total: 3 })).toBe(100);
    expect(percent({ done: 0, total: 0 })).toBe(0);
  });
});

describe('lastEntryFor', () => {
  const sessions = [
    session('2026-08-03', 'A', true, [{ name: 'Гребане', weight: 10, reps: 12 }]),
    session('2026-08-06', 'A', true, [{ name: 'Гребане', weight: 12, reps: 12 }]),
    session('2026-08-10', 'A', true, [{ name: 'Гребане', weight: 14, reps: 10 }]),
  ];

  it('взима най-скорошния запис ПРЕДИ дадената дата', () => {
    expect(lastEntryFor(sessions, 'Гребане', '2026-08-10')).toMatchObject({
      date: '2026-08-06', weight: 12,
    });
  });

  it('не гледа в бъдещето и не включва самия ден', () => {
    expect(lastEntryFor(sessions, 'Гребане', '2026-08-03')).toBeNull();
  });

  it('връща null за непознато упражнение', () => {
    expect(lastEntryFor(sessions, 'Няма такова', '2026-09-01')).toBeNull();
  });
});

describe('weekStartOf', () => {
  it('връща понеделника на седмицата', () => {
    expect(weekStartOf('2026-08-03')).toBe('2026-08-03'); // самият понеделник
    expect(weekStartOf('2026-08-09')).toBe('2026-08-03'); // неделя → същата седмица
    expect(weekStartOf('2026-08-10')).toBe('2026-08-10'); // следващият понеделник
  });

  it('минава границата на месеца назад', () => {
    expect(weekStartOf('2026-08-01')).toBe('2026-07-27'); // събота → понеделник в юли
  });
});

describe('periodStats', () => {
  // седмицата 3–9 август: Пн 3 блока, Вт 2, Ср 0, Чт 2, Пт 2, Сб 1, Нд 1 = 11 планирани
  const MON = '2026-08-03';
  const SUN = '2026-08-09';

  it('брои планираните и отметнатите за целия диапазон', () => {
    expect(periodStats(content, [], MON, SUN)).toEqual({
      done: 0, total: 11, activeDays: 6, fullDays: 0,
    });
  });

  it('почивният ден не влиза в activeDays', () => {
    // сряда (5 август) е празна → 7 дни, но 6 активни
    expect(periodStats(content, [], MON, SUN).activeDays).toBe(6);
  });

  it('брои пълен ден само при всички отметнати блокове', () => {
    const partial = [session(MON, 'morning'), session(MON, 'A')];
    expect(periodStats(content, partial, MON, SUN)).toMatchObject({ done: 2, fullDays: 0 });

    const full = [...partial, session(MON, 'walk')];
    expect(periodStats(content, full, MON, SUN)).toMatchObject({ done: 3, fullDays: 1 });
  });

  it('работи и за един-единствен ден', () => {
    expect(periodStats(content, [], MON, MON)).toEqual({
      done: 0, total: 3, activeDays: 1, fullDays: 0,
    });
  });
});

describe('blockBreakdown', () => {
  const MON = '2026-08-03';
  const SUN = '2026-08-09';

  it('групира по блок и брои планирано срещу направено', () => {
    const rows = blockBreakdown(content, [session(MON, 'A')], MON, SUN);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

    // morning е в 5 дни (неделя е без него), A в 2 (пн, чт), walk в 4 (пн, вт, пт, нд)
    expect(byKey.morning).toMatchObject({ total: 5, done: 0 });
    expect(byKey.A).toMatchObject({ total: 2, done: 1 });
    expect(byKey.walk).toMatchObject({ total: 4, done: 0 });
  });

  it('подрежда най-пропусканите отгоре', () => {
    // A e 2/2, morning 0/6 → morning трябва да е пръв
    const sessions = [session(MON, 'A'), session('2026-08-06', 'A')];
    const rows = blockBreakdown(content, sessions, MON, SUN);
    expect(rows[0].key).not.toBe('A');
    expect(rows[rows.length - 1].key).toBe('A');
  });

  it('не включва блокове, които не са планирани в периода', () => {
    // сряда сама по себе си е почивен ден
    expect(blockBreakdown(content, [], '2026-08-05', '2026-08-05')).toEqual([]);
  });
});

describe('weeklyHistory', () => {
  it('връща седмиците назад, най-новата първа', () => {
    const rows = weeklyHistory(content, [], '2026-08-12', '2026-07-01', 3);
    expect(rows.map((r) => r.monday)).toEqual(['2026-08-10', '2026-08-03', '2026-07-27']);
    expect(rows[0].sunday).toBe('2026-08-16');
  });

  it('спира преди началото на програмата', () => {
    // програма от 3 август → няма смисъл от седмици преди нея
    const rows = weeklyHistory(content, [], '2026-08-12', '2026-08-03', 8);
    expect(rows).toHaveLength(2);
    expect(rows[rows.length - 1].monday).toBe('2026-08-03');
  });

  it('включва седмицата на старта, дори програмата да започва в средата ѝ', () => {
    // старт събота 1 август → седмицата от 27 юли трябва да е налична
    const rows = weeklyHistory(content, [], '2026-08-03', '2026-08-01', 8);
    expect(rows.map((r) => r.monday)).toEqual(['2026-08-03', '2026-07-27']);
  });
});

describe('lastMeasurementIn', () => {
  const measurements = [
    { measured_on: '2026-08-03', metrics: { weight: 96 } },
    { measured_on: '2026-08-06', metrics: { weight: 95.2 } },
    { measured_on: '2026-08-11', metrics: { weight: 94.8 } },
    { measured_on: '2026-08-12', metrics: {} }, // празна — не се брои
  ];

  it('взима последната непразна мярка в диапазона', () => {
    expect(lastMeasurementIn(measurements, '2026-08-03', '2026-08-09')?.measured_on)
      .toBe('2026-08-06');
  });

  it('игнорира мерки с празни metrics', () => {
    expect(lastMeasurementIn(measurements, '2026-08-10', '2026-08-16')?.measured_on)
      .toBe('2026-08-11');
  });

  it('връща null, ако в периода няма нищо', () => {
    expect(lastMeasurementIn(measurements, '2026-09-01', '2026-09-07')).toBeNull();
  });
});

describe('formatWeekRange', () => {
  it('пише месеца веднъж, когато седмицата е в един месец', () => {
    expect(formatWeekRange('2026-08-03')).toBe('3 – 9 август');
  });

  it('пише двата месеца, когато седмицата ги пресича', () => {
    expect(formatWeekRange('2026-07-27')).toBe('27 юли – 2 август');
  });
});

describe('trackedExerciseNames и exerciseHistory', () => {
  const sessions = [
    session('2026-08-03', 'A', true, [
      { name: 'Гребане', weight: 10 },
      { name: 'Планк', time: 20 },
      { name: 'Без числа' },
    ]),
    session('2026-08-06', 'A', true, [{ name: 'Гребане', weight: 12 }]),
  ];

  it('връща само упражнения с реални числа, подредени по азбучен ред', () => {
    expect(trackedExerciseNames(sessions)).toEqual(['Гребане', 'Планк']);
  });

  it('историята е подредена по дата и ползва тегло, иначе повторения, иначе време', () => {
    expect(exerciseHistory(sessions, 'Гребане')).toEqual([
      { date: '2026-08-03', value: 10 },
      { date: '2026-08-06', value: 12 },
    ]);
    expect(exerciseHistory(sessions, 'Планк')).toEqual([{ date: '2026-08-03', value: 20 }]);
  });

  it('връща празен списък за упражнение без записи', () => {
    expect(exerciseHistory(sessions, 'Няма такова')).toEqual([]);
  });
});
