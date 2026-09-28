import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Trash2, Download, Upload, Filter, MoreHorizontal,
  ChevronLeft, Pencil, ArrowUp, ArrowDown, X,
  Bold, Italic, Underline as UnderlineIcon, Paintbrush, Type,
  Copy, Clipboard, Pin, PinOff, WrapText,
  Undo2, Redo2, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyLinkButton } from '@/components/common/CopyLinkButton';
import { detectGridShortcut } from '@/lib/gridShortcuts';
import { firstHttpUrl } from '@/lib/linkify';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Spreadsheet, CellData, ColumnDef, useSpreadsheets } from '@/hooks/useSpreadsheets';
import { evaluateFormula, getDisplayValue } from '@/lib/formulaEngine';
import { useToast } from '@/hooks/use-toast';
import lodashDebounce from 'lodash.debounce';

interface SpreadsheetEditorProps {
  spreadsheet: Spreadsheet;
  onBack: () => void;
  projectId: string;
}

interface CellPos { row: number; col: number; }
interface SelectionRange { start: CellPos; end: CellPos; }

function getCellsBetween(a: CellPos, b: CellPos) {
  return {
    minRow: Math.min(a.row, b.row),
    maxRow: Math.max(a.row, b.row),
    minCol: Math.min(a.col, b.col),
    maxCol: Math.max(a.col, b.col),
  };
}

export function SpreadsheetEditor({ spreadsheet, onBack, projectId }: SpreadsheetEditorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { updateSpreadsheet } = useSpreadsheets(projectId);

  const [data, setData] = useState<CellData[][]>(
    spreadsheet.data.length > 0 ? spreadsheet.data : createEmptyData(20, spreadsheet.column_definitions.length)
  );
  const [columns, setColumns] = useState<ColumnDef[]>(spreadsheet.column_definitions);
  const [selectedCell, setSelectedCell] = useState<CellPos | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [editingCell, setEditingCell] = useState<CellPos | null>(null);
  const [editValue, setEditValue] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [sheetName, setSheetName] = useState(spreadsheet.name);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterCol, setFilterCol] = useState<number | null>(null);
  const [filterValue, setFilterValue] = useState('');
  const [freezeHeader, setFreezeHeader] = useState<boolean>(spreadsheet.freeze_header ?? false);
  const [wrapText, setWrapText] = useState(false);

  // Undo / Redo history. Each entry is a snapshot of {data, columns}.
  const historyRef = useRef<Array<{ data: CellData[][]; columns: ColumnDef[] }>>([]);
  const futureRef = useRef<Array<{ data: CellData[][]; columns: ColumnDef[] }>>([]);
  const MAX_HISTORY = 50;

  // Column resize state
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const CELL_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
    '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280', '#ffffff',
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isInSelection = useCallback((row: number, col: number): boolean => {
    if (!selectionRange) return selectedCell?.row === row && selectedCell?.col === col;
    const { minRow, maxRow, minCol, maxCol } = getCellsBetween(selectionRange.start, selectionRange.end);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  }, [selectionRange, selectedCell]);

  const isActiveCell = useCallback((row: number, col: number): boolean => {
    return selectedCell?.row === row && selectedCell?.col === col;
  }, [selectedCell]);

  const selectionCount = useCallback((): number => {
    if (!selectionRange) return selectedCell ? 1 : 0;
    const { minRow, maxRow, minCol, maxCol } = getCellsBetween(selectionRange.start, selectionRange.end);
    return (maxRow - minRow + 1) * (maxCol - minCol + 1);
  }, [selectionRange, selectedCell]);

  // ── Save (debounced) ────────────────────────────────────────────────────────

  const saveRef = useRef(
    lodashDebounce((newData: CellData[][], newCols: ColumnDef[], name: string) => {
      updateSpreadsheet.mutate({
        id: spreadsheet.id,
        data: newData,
        column_definitions: newCols,
        name,
      });
    }, 800)
  );

  const save = useCallback((newData: CellData[][], newCols: ColumnDef[], name: string) => {
    saveRef.current(newData, newCols, name);
  }, []);

  // ── History (Undo / Redo) ─────────────────────────────────────────────────
  // MUST be defined AFTER `save` because undo/redo reference it in their deps.

  const snapshotState = useCallback(() => ({
    data: data.map(r => r.map(c => ({ ...c }))),
    columns: columns.map(c => ({ ...c })),
  }), [data, columns]);

  const pushHistory = useCallback(() => {
    historyRef.current.push(snapshotState());
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    futureRef.current = [];
  }, [snapshotState]);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) {
      toast({ description: '↶ Няма какво да се отмени' });
      return;
    }
    futureRef.current.push(snapshotState());
    setData(prev.data);
    setColumns(prev.columns);
    save(prev.data, prev.columns, sheetName);
    toast({ description: '↶ Отменено' });
  }, [snapshotState, save, sheetName, toast]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) {
      toast({ description: '↷ Няма какво да се повтори' });
      return;
    }
    historyRef.current.push(snapshotState());
    setData(next.data);
    setColumns(next.columns);
    save(next.data, next.columns, sheetName);
    toast({ description: '↷ Повторено' });
  }, [snapshotState, save, sheetName, toast]);

  // Separate save for freeze_header — only called when user explicitly toggles it
  const saveFreezeHeader = useCallback((fh: boolean) => {
    updateSpreadsheet.mutate({
      id: spreadsheet.id,
      data,
      column_definitions: columns,
      name: sheetName,
      freeze_header: fh,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadsheet.id, data, columns, sheetName]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // ── Mouse up on document (end drag) ─────────────────────────────────────────

  useEffect(() => {
    const handleMouseUp = () => { isDraggingRef.current = false; };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // ── Cell operations ─────────────────────────────────────────────────────────

  const updateCell = (row: number, col: number, value: string) => {
    pushHistory();
    const newData = data.map((r) => r.map((c) => ({ ...c })));
    while (newData.length <= row) newData.push(Array.from({ length: columns.length }, () => ({ value: '' })));
    while (newData[row].length <= col) newData[row].push({ value: '' });

    if (value.startsWith('=')) {
      newData[row][col] = { ...newData[row][col], value: '', formula: value };
    } else {
      newData[row][col] = { ...newData[row][col], value, formula: undefined };
    }
    setData(newData);
    save(newData, columns, sheetName);
  };

  const clearSelection = () => {
    pushHistory();
    const newData = data.map((r) => r.map((c) => ({ ...c })));
    if (selectionRange) {
      const { minRow, maxRow, minCol, maxCol } = getCellsBetween(selectionRange.start, selectionRange.end);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (newData[r]?.[c]) newData[r][c] = { ...newData[r][c], value: '', formula: undefined };
        }
      }
    } else if (selectedCell) {
      const { row, col } = selectedCell;
      if (newData[row]?.[col]) newData[row][col] = { ...newData[row][col], value: '', formula: undefined };
    }
    setData(newData);
    save(newData, columns, sheetName);
  };

  const copySelection = useCallback(async () => {
    const anchorRow = selectionRange ? Math.min(selectionRange.start.row, selectionRange.end.row) : selectedCell?.row;
    const anchorCol = selectionRange ? Math.min(selectionRange.start.col, selectionRange.end.col) : selectedCell?.col;
    const endRow   = selectionRange ? Math.max(selectionRange.start.row, selectionRange.end.row) : selectedCell?.row;
    const endCol   = selectionRange ? Math.max(selectionRange.start.col, selectionRange.end.col) : selectedCell?.col;

    if (anchorRow === undefined || anchorCol === undefined) return;

    const rows: string[] = [];
    for (let r = anchorRow; r <= endRow!; r++) {
      const cols: string[] = [];
      for (let c = anchorCol; c <= endCol!; c++) {
        const cell = data[r]?.[c];
        cols.push(getDisplayValue(cell, data));
      }
      rows.push(cols.join('\t'));
    }
    const text = rows.join('\n');

    // Try modern clipboard API first, fallback to execCommand
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const n = selectionCount();
    toast({ description: `📋 ${n} клетк${n === 1 ? 'а копирана' : 'и копирани'}` });
  }, [selectionRange, selectedCell, data, selectionCount, toast]);

  const pasteText = useCallback((text: string) => {
    const startRow = selectionRange
      ? Math.min(selectionRange.start.row, selectionRange.end.row)
      : selectedCell?.row;
    const startCol = selectionRange
      ? Math.min(selectionRange.start.col, selectionRange.end.col)
      : selectedCell?.col;
    if (startRow === undefined || startCol === undefined) return;

    pushHistory();
    const newData = data.map((r) => r.map((c) => ({ ...c })));
    // Normalize line endings and split
    const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    // Remove trailing empty row if present
    if (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();

    rows.forEach((rowText, rOffset) => {
      const cols = rowText.split('\t');
      cols.forEach((cellText, cOffset) => {
        const r = startRow + rOffset;
        const c = startCol + cOffset;
        if (r < newData.length && c < columns.length) {
          const trimmed = cellText.trim();
          if (trimmed.startsWith('=')) {
            newData[r][c] = { ...newData[r][c], value: '', formula: trimmed };
          } else {
            newData[r][c] = { ...newData[r][c], value: cellText, formula: undefined };
          }
        }
      });
    });
    setData(newData);
    save(newData, columns, sheetName);
    // Highlight pasted area
    if (rows.length > 0) {
      const maxCols = Math.max(...rows.map(r => r.split('\t').length));
      setSelectionRange({
        start: { row: startRow, col: startCol },
        end: { row: startRow + rows.length - 1, col: startCol + maxCols - 1 },
      });
    }
    toast({ description: `✅ Поставено (${rows.length} реда)` });
  }, [selectionRange, selectedCell, data, columns, sheetName, save, toast, pushHistory]);

  const handleNativePaste = useCallback((e: React.ClipboardEvent) => {
    if (editingCell) return; // нека input-ът си обработи paste
    e.preventDefault();
    e.stopPropagation();

    // Опитай text/plain (работи с Google Sheets, Excel, всичко)
    const text = e.clipboardData.getData('text/plain');
    if (text && text.trim()) {
      pasteText(text);
      return;
    }
    // Ако text/plain е празно, логни всички налични типове
    const types = Array.from(e.clipboardData.types);
    console.warn('[paste] No text/plain found. Available types:', types);
  }, [editingCell, pasteText]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) pasteText(text);
    } catch {
      toast({ description: 'Използвай Ctrl+V за поставяне', variant: 'destructive' });
    }
  };

  // ── Mouse handlers for drag-selection ──────────────────────────────────────

  const handleCellMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    if (editingCell) return;
    e.preventDefault();
    isDraggingRef.current = true;
    if (e.shiftKey && selectedCell) {
      setSelectionRange({ start: selectedCell, end: { row, col } });
    } else {
      setSelectedCell({ row, col });
      setSelectionRange(null);
    }
    // Фокусирай grid-а за да работи Ctrl+C/V
    requestAnimationFrame(() => gridRef.current?.focus());
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (!isDraggingRef.current || editingCell) return;
    const anchor = selectedCell ?? { row, col };
    setSelectionRange({ start: anchor, end: { row, col } });
  };

  // ── Click / double-click ────────────────────────────────────────────────────

  const handleCellClick = (row: number, col: number) => {
    if (!isDraggingRef.current) {
      setSelectedCell({ row, col });
      if (!selectionRange) setSelectionRange(null);
    }
    // ВАЖНО: фокусирай grid-а за да работи Ctrl+V (onPaste)
    requestAnimationFrame(() => gridRef.current?.focus());
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
    const cell = data[row]?.[col];
    setEditValue(cell?.formula || cell?.value || '');
    setSelectionRange(null);
  };

  const handleCellBlur = () => {
    if (editingCell) {
      updateCell(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
      if (editingCell) setSelectedCell({ row: editingCell.row + 1, col: editingCell.col });
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellBlur();
      if (editingCell) {
        const nextCol = editingCell.col + 1;
        if (nextCol < columns.length) {
          setSelectedCell({ row: editingCell.row, col: nextCol });
          setTimeout(() => handleCellDoubleClick(editingCell.row, nextCol), 0);
        }
      }
    }
  };

  // ── Grid keyboard ───────────────────────────────────────────────────────────

  const handleGridKeyDown = async (e: React.KeyboardEvent) => {
    if (editingCell) return;

    // Преките пътища се разпознават по ФИЗИЧЕСКИЯ клавиш, не по буквата:
    // на българска подредба Ctrl+C идва като `key === 'с'` (кирилско) и старото
    // сравнение с латинско 'c' не хващаше — копирането тихо не се случваше.
    // Виж `lib/gridShortcuts.ts`.
    switch (detectGridShortcut(e)) {
      case 'undo':
        e.preventDefault();
        undo();
        return;
      case 'redo':
        e.preventDefault();
        redo();
        return;
      case 'copy':
        e.preventDefault();
        await copySelection();
        return;
      case 'paste':
        return; // оставяме го на native onPaste на grid-а
      case 'selectAll':
        e.preventDefault();
        if (data.length > 0 && columns.length > 0) {
          setSelectedCell({ row: 0, col: 0 });
          setSelectionRange({ start: { row: 0, col: 0 }, end: { row: data.length - 1, col: columns.length - 1 } });
        }
        return;
    }

    if (!selectedCell) return;
    const { row, col } = selectedCell;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = { row: Math.min(row + 1, data.length - 1), col };
      setSelectedCell(next);
      if (e.shiftKey) setSelectionRange({ start: selectionRange?.start || selectedCell, end: next });
      else setSelectionRange(null);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = { row: Math.max(row - 1, 0), col };
      setSelectedCell(next);
      if (e.shiftKey) setSelectionRange({ start: selectionRange?.start || selectedCell, end: next });
      else setSelectionRange(null);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = { row, col: Math.min(col + 1, columns.length - 1) };
      setSelectedCell(next);
      if (e.shiftKey) setSelectionRange({ start: selectionRange?.start || selectedCell, end: next });
      else setSelectionRange(null);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = { row, col: Math.max(col - 1, 0) };
      setSelectedCell(next);
      if (e.shiftKey) setSelectionRange({ start: selectionRange?.start || selectedCell, end: next });
      else setSelectionRange(null);
    } else if (e.key === 'Enter' || e.key === 'F2') {
      handleCellDoubleClick(row, col);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      clearSelection();
    } else if (e.key === 'Escape') {
      setSelectionRange(null);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      setEditingCell({ row, col });
      setEditValue(e.key);
      setSelectionRange(null);
    }
  };

  // ── Formatting ─────────────────────────────────────────────────────────────

  const toggleFormat = (prop: 'bold' | 'italic' | 'underline') => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    pushHistory();
    const newData = data.map((r) => r.map((c) => ({ ...c })));
    const cell = newData[row]?.[col];
    if (!cell) return;
    cell[prop] = !cell[prop];
    setData(newData);
    save(newData, columns, sheetName);
  };

  const setCellColor = (prop: 'textColor' | 'bgColor', color: string | undefined) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    pushHistory();
    const newData = data.map((r) => r.map((c) => ({ ...c })));
    const cell = newData[row]?.[col];
    if (!cell) return;
    cell[prop] = color;
    setData(newData);
    save(newData, columns, sheetName);
  };

  // ── Rows / Columns ──────────────────────────────────────────────────────────

  const addRow = () => {
    pushHistory();
    const newRow = Array.from({ length: columns.length }, () => ({ value: '' }));
    const newData = [...data, newRow];
    setData(newData);
    save(newData, columns, sheetName);
  };

  const deleteRow = (rowIdx: number) => {
    pushHistory();
    const newData = data.filter((_, i) => i !== rowIdx);
    setData(newData);
    save(newData, columns, sheetName);
  };

  const addColumn = () => {
    pushHistory();
    const letter = getColumnLetter(columns.length);
    const newCols = [...columns, { name: letter, width: 160 }];
    const newData = data.map((row) => [...row, { value: '' }]);
    setColumns(newCols);
    setData(newData);
    save(newData, newCols, sheetName);
  };

  const deleteColumn = (colIdx: number) => {
    if (columns.length <= 1) return;
    pushHistory();
    const newCols = columns.filter((_, i) => i !== colIdx);
    const newData = data.map((row) => row.filter((_, i) => i !== colIdx));
    setColumns(newCols);
    setData(newData);
    save(newData, newCols, sheetName);
  };

  // ── Column resize ──────────────────────────────────────────────────────────

  const startColumnResize = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columns[colIdx]?.width || 120;
    resizingRef.current = { colIdx, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, Math.min(800, resizingRef.current.startWidth + delta));
      setColumns(cols => {
        const next = [...cols];
        if (next[resizingRef.current!.colIdx]) {
          next[resizingRef.current!.colIdx] = { ...next[resizingRef.current!.colIdx], width: newWidth };
        }
        return next;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (resizingRef.current) {
        // Snapshot AFTER resize is complete (so undo restores the BEFORE-resize widths)
        // We push history at the start so that undo brings back the original widths
        save(data, columns, sheetName);
      }
      resizingRef.current = null;
    };

    // Push history BEFORE starting the drag, so undo restores original width
    pushHistory();

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const autoFitColumn = (colIdx: number) => {
    // Auto-fit width based on content (max 400px)
    let maxLen = columns[colIdx]?.name.length || 0;
    for (const row of data) {
      const v = getDisplayValue(row[colIdx], data);
      if (v.length > maxLen) maxLen = v.length;
    }
    const newWidth = Math.max(80, Math.min(400, maxLen * 8 + 40));
    pushHistory();
    const newCols = [...columns];
    newCols[colIdx] = { ...newCols[colIdx], width: newWidth };
    setColumns(newCols);
    save(data, newCols, sheetName);
  };

  const toggleFreezeHeader = () => {
    const newVal = !freezeHeader;
    setFreezeHeader(newVal);
    saveFreezeHeader(newVal);
    toast({ description: newVal ? '📌 Първият ред е закачен като заглавие' : 'Редът е откачен' });
  };

  // ── Sort / Filter / Export ──────────────────────────────────────────────────

  const handleSort = (colIdx: number) => {
    const dir = sortCol === colIdx && sortDir === 'asc' ? 'desc' : 'asc';
    setSortCol(colIdx);
    setSortDir(dir);
  };

  const handleRename = () => {
    save(data, columns, sheetName);
    setRenameOpen(false);
  };

  const exportCSV = () => {
    const header = columns.map((c) => c.name).join(',');
    const rows = getVisibleData().map((row) =>
      row.map((cell) => {
        const val = getDisplayValue(cell, data);
        return val.includes(',') ? `"${val}"` : val;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheetName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) return;

      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headerRow = parseLine(lines[0]);
      const newCols: ColumnDef[] = headerRow.map((name, i) => ({ name: name || getColumnLetter(i), width: 120 }));
      const newData: CellData[][] = lines.slice(1).map((line) => {
        const vals = parseLine(line);
        return newCols.map((_, i) => ({ value: vals[i] || '' }));
      });
      while (newData.length < 5) newData.push(newCols.map(() => ({ value: '' })));
      setColumns(newCols);
      setData(newData);
      save(newData, newCols, sheetName);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Visible data (sort + filter, skip header row) ─────────────────────────

  const getVisibleData = (): CellData[][] => {
    // If freeze header, exclude row 0 from sort/filter
    const startIdx = freezeHeader ? 1 : 0;
    let visible = data.slice(startIdx);

    if (filterCol !== null && filterValue) {
      visible = visible.filter((row) => {
        const cell = row[filterCol];
        const display = getDisplayValue(cell, data);
        return display.toLowerCase().includes(filterValue.toLowerCase());
      });
    }

    if (sortCol !== null) {
      visible.sort((a, b) => {
        const aVal = getDisplayValue(a[sortCol], data);
        const bVal = getDisplayValue(b[sortCol], data);
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    return visible;
  };

  const headerRow = freezeHeader && data.length > 0 ? data[0] : null;
  const visibleData = getVisibleData();

  const formulaBarValue = selectedCell
    ? (data[selectedCell.row]?.[selectedCell.col]?.formula || data[selectedCell.row]?.[selectedCell.col]?.value || '')
    : '';

  const count = selectionCount();
  const hasMultiSelection = count > 1;

  // ── Render cell ─────────────────────────────────────────────────────────────

  const renderCell = (rowIdx: number, colIdx: number, cell: CellData | undefined, isHeaderRow = false) => {
    const isSelected = isActiveCell(rowIdx, colIdx);
    const inRange = isInSelection(rowIdx, colIdx);
    const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;
    const displayValue = getDisplayValue(cell, data);

    const cellStyle: React.CSSProperties = {
      width: columns[colIdx]?.width,
      minWidth: columns[colIdx]?.width,
      maxWidth: columns[colIdx]?.width,      // ФИКСИРАНА ширина — не се разтяга
      overflow: 'hidden',                    // НЕ излиза извън клетката
      backgroundColor: isHeaderRow
        ? undefined
        : (inRange && !isSelected) ? 'rgb(219 234 254 / 0.6)' : cell?.bgColor || undefined,
      color: cell?.textColor || undefined,
      fontWeight: isHeaderRow ? 'bold' : (cell?.bold ? 'bold' : undefined),
      fontStyle: cell?.italic ? 'italic' : undefined,
      textDecoration: cell?.underline ? 'underline' : undefined,
    };

    // Има ли клетката адрес, който да се отваря със стрелка? (само http/https)
    const cellUrl = isEditing ? null : firstHttpUrl(displayValue);

    return (
      <td
        key={colIdx}
        className={[
          'border border-border px-1 py-0 text-sm cursor-cell select-none',
          isSelected ? 'ring-2 ring-primary ring-inset z-[3]' : '',
          inRange && !isSelected ? 'bg-blue-100/60 dark:bg-blue-900/30' : '',
          isHeaderRow
            ? 'sticky bg-muted/90 dark:bg-muted/90 font-semibold z-[6]'
            : '',
        ].join(' ')}
        style={{
          ...cellStyle,
          top: isHeaderRow ? '33px' : undefined,
          position: isHeaderRow ? 'sticky' : undefined,
        }}
        onMouseDown={(e) => handleCellMouseDown(e, rowIdx, colIdx)}
        onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
        onClick={() => handleCellClick(rowIdx, colIdx)}
        onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
        // Native browser tooltip — shows full content on hover for truncated cells
        title={!isEditing && displayValue && displayValue.length > 10 ? displayValue : undefined}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            className="w-full h-7 bg-transparent border-none outline-none text-sm font-mono px-1"
            style={{ color: cell?.textColor || undefined, fontWeight: cell?.bold ? 'bold' : undefined }}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleCellKeyDown}
          />
        ) : (
          <div className={[
            'flex items-start gap-1 px-1 text-sm',
            wrapText
              ? 'whitespace-pre-wrap break-all py-1 min-h-[28px]'
              : 'h-7 items-center',
          ].join(' ')}>
            <span className={wrapText ? 'flex-1 min-w-0' : 'flex-1 min-w-0 truncate'}>
              {displayValue}
            </span>
            {cellUrl && (
              /*
                Линкът се отваря САМО от стрелката, не от целия текст: клетката
                се избира с клик, а адресът обикновено я запълва — иначе всеки
                опит да маркираш клетка щеше да отваря видеото.
                stopPropagation-ите пазят избора/маркирането да не тръгне.
              */
              <a
                href={cellUrl}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                title={`Отвори: ${cellUrl}`}
                aria-label="Отвори линка в нов раздел"
                className="shrink-0 text-primary opacity-60 hover:opacity-100 transition-opacity"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </td>
    );
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" onMouseLeave={() => { isDraggingRef.current = false; }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3
          className="font-semibold text-lg cursor-pointer hover:underline"
          onClick={() => setRenameOpen(true)}
        >
          {sheetName}
        </h3>
        <CopyLinkButton title="Копирай линк към таблицата" />
        <div className="ml-auto flex gap-1 flex-wrap">
          {/* Wrap text toggle */}
          <Button
            variant={wrapText ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWrapText(v => !v)}
            title={wrapText ? 'Изключи пренос' : 'Включи пренос на текст'}
          >
            <WrapText className="w-3 h-3 mr-1" />
            Wrap
          </Button>
          {/* Undo / Redo */}
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={historyRef.current.length === 0}
            title="Отмени (Ctrl+Z)"
            data-testid="spreadsheet-undo-btn"
          >
            <Undo2 className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={futureRef.current.length === 0}
            title="Повтори (Ctrl+Y)"
            data-testid="spreadsheet-redo-btn"
          >
            <Redo2 className="w-3 h-3" />
          </Button>
          {/* Freeze header toggle */}
          <Button
            variant={freezeHeader ? 'default' : 'outline'}
            size="sm"
            onClick={toggleFreezeHeader}
            title={freezeHeader ? t('spreadsheets.unfreezeHeader', 'Откачи заглавен ред') : t('spreadsheets.freezeHeader', 'Закачи заглавен ред')}
          >
            {freezeHeader ? <PinOff className="w-3 h-3 mr-1" /> : <Pin className="w-3 h-3 mr-1" />}
            {freezeHeader
              ? t('spreadsheets.unfreezeHeader', 'Откачи заглавие')
              : t('spreadsheets.freezeHeader', 'Закачи ред 1')}
          </Button>
          <Button variant="outline" size="sm" onClick={addColumn}>
            <Plus className="w-3 h-3 mr-1" />
            {t('spreadsheets.addColumn', 'Колона')}
          </Button>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="w-3 h-3 mr-1" />
            {t('spreadsheets.addRow', 'Ред')}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-3 h-3 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {t('spreadsheets.importCSV', 'Импорт')}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCSV} />
        </div>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 mb-2 border border-border rounded-lg px-3 py-1.5 bg-muted/30">
        <span className="text-xs font-mono text-muted-foreground min-w-[40px]">
          {selectedCell ? `${columns[selectedCell.col]?.name || ''}${selectedCell.row + 1}` : ''}
        </span>
        <span className="text-muted-foreground">|</span>
        <span className="text-sm font-mono truncate flex-1">{formulaBarValue}</span>
      </div>

      {/* Cell formatting toolbar */}
      {selectedCell && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <Button
            variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${data[selectedCell.row]?.[selectedCell.col]?.bold ? 'bg-muted' : ''}`}
            onClick={() => toggleFormat('bold')}
          >
            <Bold className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${data[selectedCell.row]?.[selectedCell.col]?.italic ? 'bg-muted' : ''}`}
            onClick={() => toggleFormat('italic')}
          >
            <Italic className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${data[selectedCell.row]?.[selectedCell.col]?.underline ? 'bg-muted' : ''}`}
            onClick={() => toggleFormat('underline')}
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Цвят на текст">
                <Type className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex gap-1 flex-wrap max-w-[160px]">
                {CELL_COLORS.map((color) => (
                  <button key={color} onClick={() => setCellColor('textColor', color)}
                    className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }} />
                ))}
                <button onClick={() => setCellColor('textColor', undefined)}
                  className="w-5 h-5 rounded border border-border text-[9px] flex items-center justify-center">✕</button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Фон на клетка">
                <Paintbrush className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex gap-1 flex-wrap max-w-[160px]">
                {CELL_COLORS.map((color) => (
                  <button key={color} onClick={() => setCellColor('bgColor', color)}
                    className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }} />
                ))}
                <button onClick={() => setCellColor('bgColor', undefined)}
                  className="w-5 h-5 rounded border border-border text-[9px] flex items-center justify-center">✕</button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Multi-selection actions */}
          {hasMultiSelection && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <span className="text-xs text-muted-foreground px-1">
                {count} клетки
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={copySelection}>
                <Copy className="w-3 h-3" /> Копирай
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={pasteFromClipboard}>
                <Clipboard className="w-3 h-3" /> Постави
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive" onClick={clearSelection}>
                <Trash2 className="w-3 h-3" /> Изтрий
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectionRange(null); }}>
                <X className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Filter bar */}
      {filterCol !== null && (
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {t('spreadsheets.filterBy', 'Филтър по')} {columns[filterCol]?.name}:
          </span>
          <Input className="h-7 text-xs w-40" value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder={t('spreadsheets.filterPlaceholder', 'Филтрирай...')} />
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => { setFilterCol(null); setFilterValue(''); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Selection hint — fixed height, no layout shift */}
      <div className="text-[10px] text-muted-foreground mb-1 px-1 h-4 leading-4">
        {hasMultiSelection
          ? `✅ ${count} клетки избрани  ·  Ctrl+C копирай  ·  Ctrl+V постави  ·  Delete изтрий  ·  Ctrl+Z отмени`
          : '💡 Drag за диапазон  ·  Ctrl+C/V копирай/постави  ·  Ctrl+Z отмени  ·  Влачи ръба на колоната за оразмеряване  ·  Hover за tooltip'
        }
      </div>

      {/* Grid */}
      <ScrollArea className="flex-1 border border-border rounded-lg overflow-auto">
        <div
          ref={gridRef}
          className="min-w-max"
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
          onPaste={handleNativePaste}
          style={{ userSelect: 'none' }}
        >
          <table className="border-collapse" style={{ tableLayout: 'fixed', width: `${columns.reduce((s, c) => s + (c.width || 120), 40)}px` }}>
            <thead>
              {/* Column letters header */}
              <tr className="bg-muted">
                <th className="border border-border px-2 py-1 text-xs text-muted-foreground w-10 min-w-[40px] sticky top-0 left-0 z-20 bg-muted">#</th>
                {columns.map((col, colIdx) => (
                  <th
                    key={colIdx}
                    className="border border-border px-1 py-1 text-xs font-medium text-muted-foreground sticky top-0 z-10 bg-muted"
                    style={{ width: col.width, minWidth: col.width, position: 'sticky' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{col.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => handleSort(colIdx)}>
                            {sortCol === colIdx && sortDir === 'asc' ? <ArrowDown className="w-3 h-3 mr-2" /> : <ArrowUp className="w-3 h-3 mr-2" />}
                            {t('spreadsheets.sort', 'Сортирай')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setFilterCol(colIdx); setFilterValue(''); }}>
                            <Filter className="w-3 h-3 mr-2" />
                            {t('spreadsheets.filter', 'Филтрирай')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const newName = prompt(t('spreadsheets.renameColumn', 'Преименувай колона'), col.name);
                            if (newName) {
                              pushHistory();
                              const newCols = [...columns];
                              newCols[colIdx] = { ...newCols[colIdx], name: newName };
                              setColumns(newCols);
                              save(data, newCols, sheetName);
                            }
                          }}>
                            <Pencil className="w-3 h-3 mr-2" />
                            {t('spreadsheets.rename', 'Преименувай')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => autoFitColumn(colIdx)}>
                            <WrapText className="w-3 h-3 mr-2" />
                            {t('spreadsheets.autoFitColumn', 'Авто-широчина')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteColumn(colIdx)}>
                            <Trash2 className="w-3 h-3 mr-2" />
                            {t('common.delete', 'Изтрий')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Resize handle — drag right edge to resize column */}
                    <div
                      onMouseDown={(e) => startColumnResize(e, colIdx)}
                      onDoubleClick={() => autoFitColumn(colIdx)}
                      title="Влачи за оразмеряване · Двоен клик за авто-широчина"
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 transition-colors z-20"
                      style={{ touchAction: 'none' }}
                      data-testid={`column-resize-${colIdx}`}
                    />
                  </th>
                ))}
              </tr>

              {/* Frozen header row (row 0) */}
              {freezeHeader && headerRow && (
                <tr className="bg-muted/80 border-b-2 border-primary/30">
                  <td className="border border-border px-2 py-0.5 text-xs text-primary font-bold text-center bg-muted/90 sticky left-0 z-[7]"
                    style={{ position: 'sticky', top: '33px' }}>
                    📌
                  </td>
                  {columns.map((_, colIdx) => renderCell(0, colIdx, headerRow[colIdx], true))}
                </tr>
              )}
            </thead>
            <tbody>
              {visibleData.map((row, visIdx) => {
                // When freeze header, actual row index = visIdx + 1
                const rowIdx = freezeHeader ? visIdx + 1 : visIdx;
                return (
                  <tr key={rowIdx} className="hover:bg-muted/20">
                    <td className="border border-border px-2 py-0.5 text-xs text-muted-foreground text-center bg-muted/50 sticky left-0 z-[5]">
                      <div className="flex items-center justify-between">
                        <span>{rowIdx + 1}</span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-4 w-4"
                          style={{ opacity: 0 }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                          onClick={() => deleteRow(rowIdx)}
                        >
                          <Trash2 className="w-2.5 h-2.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                    {columns.map((_, colIdx) => renderCell(rowIdx, colIdx, row[colIdx]))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('spreadsheets.renameSheet', 'Преименувай таблица')}</DialogTitle>
          </DialogHeader>
          <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
          <DialogFooter>
            <Button onClick={handleRename}>{t('common.save', 'Запази')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function createEmptyData(rows: number, cols: number): CellData[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: '' }))
  );
}

function getColumnLetter(index: number): string {
  let result = '';
  let i = index;
  while (i >= 0) {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  }
  return result;
}
