import type { CellData } from '@/hooks/useSpreadsheets';

// Convert column letter to index: A->0, B->1, ..., Z->25, AA->26
function colLetterToIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

// Parse cell reference like "A1" -> { col: 0, row: 0 }
function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: colLetterToIndex(match[1]), row: parseInt(match[2]) - 1 };
}

// Parse range like "A1:B3" -> array of cell refs
function parseRange(range: string): { col: number; row: number }[] {
  const parts = range.split(':');
  if (parts.length !== 2) return [];
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [];

  const cells: { col: number; row: number }[] = [];
  for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
    for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

function getCellValues(data: CellData[][], refs: { col: number; row: number }[]): number[] {
  return refs
    .map((ref) => {
      const row = data[ref.row];
      if (!row) return NaN;
      const cell = row[ref.col];
      if (!cell) return NaN;
      const val = cell.formula ? evaluateFormula(cell.formula, data) : parseFloat(cell.value);
      return typeof val === 'number' ? val : parseFloat(String(val));
    })
    .filter((v) => !isNaN(v));
}

function resolveArg(arg: string, data: CellData[][]): number[] {
  arg = arg.trim();
  // Range like A1:B3
  if (arg.includes(':')) {
    return getCellValues(data, parseRange(arg));
  }
  // Single cell ref
  const ref = parseCellRef(arg);
  if (ref) {
    return getCellValues(data, [ref]);
  }
  // Literal number
  const num = parseFloat(arg);
  return isNaN(num) ? [] : [num];
}

// Get raw string value from a cell reference
function getCellStringValue(ref: string, data: CellData[][]): string {
  const parsed = parseCellRef(ref.trim());
  if (!parsed) return ref.trim();
  const row = data[parsed.row];
  if (!row) return '';
  const cell = row[parsed.col];
  if (!cell) return '';
  if (cell.formula) return String(evaluateFormula(cell.formula, data));
  return cell.value;
}

// Split function arguments respecting nested parentheses
function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  args.push(current.trim());
  return args;
}

// Strip surrounding quotes from a string argument
function stripQuotes(s: string): string {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// Resolve an argument to a string (supports cell refs and quoted strings)
function resolveStringArg(arg: string, data: CellData[][]): string {
  arg = arg.trim();
  if (arg.startsWith('"') || arg.startsWith("'")) return stripQuotes(arg);
  const ref = parseCellRef(arg);
  if (ref) return getCellStringValue(arg, data);
  return arg;
}

// Resolve an argument to a number
function resolveNumericArg(arg: string, data: CellData[][]): number {
  arg = arg.trim();
  const ref = parseCellRef(arg);
  if (ref) {
    const vals = getCellValues(data, [ref]);
    return vals.length ? vals[0] : 0;
  }
  const num = parseFloat(arg);
  return isNaN(num) ? 0 : num;
}

export function evaluateFormula(formula: string, data: CellData[][]): string | number {
  try {
    const upper = formula.toUpperCase().trim();
    if (!upper.startsWith('=')) return formula;
    const expr = upper.substring(1).trim();
    // Keep original case for string operations
    const exprOriginal = formula.trim().substring(1).trim();

    // SUM(...)
    const sumMatch = expr.match(/^SUM\((.+)\)$/);
    if (sumMatch) {
      const vals = resolveArg(sumMatch[1], data);
      return vals.reduce((a, b) => a + b, 0);
    }

    // AVG / AVERAGE(...)
    const avgMatch = expr.match(/^(?:AVG|AVERAGE)\((.+)\)$/);
    if (avgMatch) {
      const vals = resolveArg(avgMatch[1], data);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }

    // MIN(...)
    const minMatch = expr.match(/^MIN\((.+)\)$/);
    if (minMatch) {
      const vals = resolveArg(minMatch[1], data);
      return vals.length ? Math.min(...vals) : 0;
    }

    // MAX(...)
    const maxMatch = expr.match(/^MAX\((.+)\)$/);
    if (maxMatch) {
      const vals = resolveArg(maxMatch[1], data);
      return vals.length ? Math.max(...vals) : 0;
    }

    // COUNT(...)
    const countMatch = expr.match(/^COUNT\((.+)\)$/);
    if (countMatch) {
      const vals = resolveArg(countMatch[1], data);
      return vals.length;
    }

    // IF(condition, trueVal, falseVal)
    const ifMatch = expr.match(/^IF\((.+)\)$/);
    if (ifMatch) {
      const args = splitArgs(ifMatch[1]);
      if (args.length < 3) return '#ERROR';
      const condition = args[0].trim();

      // Parse comparison operators
      let condResult = false;
      const compMatch = condition.match(/^(.+?)(>=|<=|<>|!=|>|<|=)(.+)$/);
      if (compMatch) {
        const left = resolveNumericArg(compMatch[1], data);
        const right = resolveNumericArg(compMatch[3], data);
        const op = compMatch[2];
        if (op === '>') condResult = left > right;
        else if (op === '<') condResult = left < right;
        else if (op === '>=') condResult = left >= right;
        else if (op === '<=') condResult = left <= right;
        else if (op === '=' || op === '==') condResult = left === right;
        else if (op === '<>' || op === '!=') condResult = left !== right;
      } else {
        condResult = resolveNumericArg(condition, data) !== 0;
      }

      const resultArg = condResult ? args[1] : args[2];
      // Try as number first
      const numResult = parseFloat(resultArg.trim());
      if (!isNaN(numResult) && !resultArg.trim().startsWith('"')) return numResult;
      return resolveStringArg(resultArg, data);
    }

    // CONCAT(...)
    const concatMatch = expr.match(/^CONCAT\((.+)\)$/);
    if (concatMatch) {
      const args = splitArgs(concatMatch[1]);
      return args.map(a => resolveStringArg(a, data)).join('');
    }

    // TODAY()
    if (expr === 'TODAY()') {
      return new Date().toISOString().split('T')[0];
    }

    // NOW()
    if (expr === 'NOW()') {
      return new Date().toLocaleString();
    }

    // YEAR(ref), MONTH(ref), DAY(ref)
    const datePartMatch = expr.match(/^(YEAR|MONTH|DAY)\((.+)\)$/);
    if (datePartMatch) {
      const fn = datePartMatch[1];
      const val = resolveStringArg(datePartMatch[2], data);
      const d = new Date(val);
      if (isNaN(d.getTime())) return '#ERROR';
      if (fn === 'YEAR') return d.getFullYear();
      if (fn === 'MONTH') return d.getMonth() + 1;
      if (fn === 'DAY') return d.getDate();
    }

    // LEN(ref)
    const lenMatch = expr.match(/^LEN\((.+)\)$/);
    if (lenMatch) {
      return resolveStringArg(lenMatch[1], data).length;
    }

    // UPPER(ref)
    const upperMatch = exprOriginal.toUpperCase().match(/^UPPER\((.+)\)$/);
    if (upperMatch) {
      return resolveStringArg(upperMatch[1], data).toUpperCase();
    }

    // LOWER(ref)
    const lowerMatch = exprOriginal.toUpperCase().match(/^LOWER\((.+)\)$/);
    if (lowerMatch) {
      return resolveStringArg(lowerMatch[1], data).toLowerCase();
    }

    // Simple cell reference
    const ref = parseCellRef(expr);
    if (ref) {
      const vals = getCellValues(data, [ref]);
      return vals.length ? vals[0] : '';
    }

    // Simple arithmetic with cell references: e.g., A1+B1, A1*2
    const arithmeticExpr = expr.replace(/([A-Z]+\d+)/g, (match) => {
      const cellRef = parseCellRef(match);
      if (!cellRef) return '0';
      const vals = getCellValues(data, [cellRef]);
      return vals.length ? String(vals[0]) : '0';
    });

    // Safe eval for simple arithmetic
    if (/^[\d+\-*/().  ]+$/.test(arithmeticExpr)) {
      const result = Function('"use strict"; return (' + arithmeticExpr + ')')();
      return typeof result === 'number' && isFinite(result) ? result : '#ERROR';
    }

    return '#ERROR';
  } catch {
    return '#ERROR';
  }
}

export function getDisplayValue(cell: CellData | undefined, data: CellData[][]): string {
  if (!cell) return '';
  if (cell.formula) {
    const result = evaluateFormula(cell.formula, data);
    return String(result);
  }
  return cell.value;
}
