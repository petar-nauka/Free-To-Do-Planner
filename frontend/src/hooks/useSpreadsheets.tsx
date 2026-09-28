import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { buildDuplicatePayload } from '@/lib/spreadsheetDuplicate';
import type { TablesInsert } from '@/integrations/supabase/types';

export interface ColumnDef {
  name: string;
  width: number;
}

export interface CellData {
  value: string;
  formula?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  bgColor?: string;
}

export interface Spreadsheet {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  data: CellData[][];
  column_definitions: ColumnDef[];
  freeze_header?: boolean;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { name: 'A', width: 120 },
  { name: 'B', width: 120 },
  { name: 'C', width: 120 },
  { name: 'D', width: 120 },
  { name: 'E', width: 120 },
];

const DEFAULT_ROWS = 20;

function createEmptyData(rows: number, cols: number): CellData[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: '' }))
  );
}

export function useSpreadsheets(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allSpreadsheets = [], isLoading } = useQuery({
    queryKey: ['spreadsheets', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spreadsheets')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as any[]).map((s) => ({
        ...s,
        data: Array.isArray(s.data) ? s.data : [],
        column_definitions: Array.isArray(s.column_definitions) ? s.column_definitions : DEFAULT_COLUMNS,
      })) as Spreadsheet[];
    },
    enabled: !!user && !!projectId,
  });

  const spreadsheets = allSpreadsheets.filter((s) => !s.archived_at);
  const archivedSpreadsheets = allSpreadsheets.filter((s) => !!s.archived_at);

  const createSpreadsheet = useMutation({
    mutationFn: async ({ name }: { name?: string }) => {
      const cols = DEFAULT_COLUMNS;
      const data = createEmptyData(DEFAULT_ROWS, cols.length);
      const { data: result, error } = await supabase
        .from('spreadsheets')
        .insert({
          project_id: projectId!,
          user_id: user!.id,
          name: name || 'Untitled',
          data: data as any,
          column_definitions: cols as any,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spreadsheets', projectId] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  /** Пълно копие на таблица: колони, съдържание, форматиране — виж `lib/spreadsheetDuplicate.ts`. */
  const duplicateSpreadsheet = useMutation({
    mutationFn: async (source: Spreadsheet) => {
      const { data: result, error } = await supabase
        .from('spreadsheets')
        // Колоните `data` и `column_definitions` са `Json` в базата. Нашите
        // структури са съвместими по съдържание, но TypeScript не приема
        // интерфейс за `Json` (липсва индексен подпис), затова се казва изрично
        // какъв запис вкарваме — вместо `as any`, както е другаде във файла.
        .insert(buildDuplicatePayload(source, { projectId: projectId!, userId: user!.id }) as unknown as TablesInsert<'spreadsheets'>)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['spreadsheets', projectId] });
      toast({ title: 'Таблицата е дублирана', description: result?.name });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateSpreadsheet = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Spreadsheet> & { id: string }) => {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.data !== undefined) payload.data = updates.data;
      if (updates.column_definitions !== undefined) payload.column_definitions = updates.column_definitions;
      if (updates.freeze_header !== undefined) payload.freeze_header = updates.freeze_header;

      const { data, error } = await supabase
        .from('spreadsheets')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spreadsheets', projectId] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const archiveSpreadsheet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('spreadsheets')
        .update({ archived_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spreadsheets', projectId] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const unarchiveSpreadsheet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('spreadsheets')
        .update({ archived_at: null } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spreadsheets', projectId] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSpreadsheet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('spreadsheets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spreadsheets', projectId] });
      toast({ title: 'Spreadsheet deleted' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    spreadsheets,
    archivedSpreadsheets,
    isLoading,
    createSpreadsheet,
    duplicateSpreadsheet,
    updateSpreadsheet,
    archiveSpreadsheet,
    unarchiveSpreadsheet,
    deleteSpreadsheet,
  };
}
