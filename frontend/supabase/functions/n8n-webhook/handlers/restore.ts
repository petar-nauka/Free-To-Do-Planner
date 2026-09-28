import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../utils.ts";

interface RestorePayload {
  backup: {
    projects?: Record<string, unknown>[];
    tasks?: Record<string, unknown>[];
    task_tags?: Record<string, unknown>[];
    notes?: Record<string, unknown>[];
    spreadsheets?: Record<string, unknown>[];
    reminders?: Record<string, unknown>[];
    recurring_tasks?: Record<string, unknown>[];
    today_plans?: Record<string, unknown>[];
    mit_tasks?: Record<string, unknown>[];
    priority_tasks?: Record<string, unknown>[];
  };
  mode?: "merge" | "replace";
}

export async function handleRestore(
  supabase: SupabaseClient,
  userId: string,
  payload: RestorePayload
) {
  if (!payload.backup) {
    return jsonResponse({ error: "backup object is required" }, 400);
  }

  const backup = payload.backup;
  const mode = payload.mode || "merge";
  const stats: Record<string, number> = {};

  // In replace mode, delete all existing data first
  if (mode === "replace") {
    const { data: existingProjects } = await supabase
      .from("projects").select("id").eq("user_id", userId);
    const existingIds = existingProjects?.map(p => p.id) || [];

    if (existingIds.length > 0) {
      // Delete in correct order (dependencies first)
      const planIds = await supabase.from("today_plans").select("id").in("project_id", existingIds);
      if (planIds.data?.length) {
        await supabase.from("mit_tasks").delete().in("today_plan_id", planIds.data.map(p => p.id));
      }
      await supabase.from("priority_tasks").delete().eq("user_id", userId);
      await supabase.from("today_plans").delete().in("project_id", existingIds);
      await supabase.from("attachments").delete().in("project_id", existingIds);
      await supabase.from("reminders").delete().in("project_id", existingIds);
      await supabase.from("recurring_tasks").delete().in("project_id", existingIds);
      // task_tags are cascade-deleted with tasks
      await supabase.from("tasks").delete().in("project_id", existingIds);
      await supabase.from("notes").delete().in("project_id", existingIds);
      await supabase.from("spreadsheets").delete().in("project_id", existingIds);
      await supabase.from("projects").delete().eq("user_id", userId);
    }
  }

  // Helper to upsert a batch
  async function upsertBatch(table: string, rows: Record<string, unknown>[], overrideUserId = true) {
    if (!rows?.length) return 0;
    const prepared = rows.map(r => ({
      ...r,
      ...(overrideUserId && 'user_id' in r ? { user_id: userId } : {}),
    }));
    const { error } = await supabase.from(table).upsert(prepared, { onConflict: "id" });
    if (error) {
      console.error(`Restore error on ${table}:`, error);
      throw new Error(`Failed to restore ${table}: ${error.message}`);
    }
    return prepared.length;
  }

  // Restore in dependency order
  stats.projects = await upsertBatch("projects", backup.projects || []);
  stats.tasks = await upsertBatch("tasks", backup.tasks || []);
  stats.task_tags = await upsertBatch("task_tags", backup.task_tags || [], false);
  stats.notes = await upsertBatch("notes", backup.notes || []);
  stats.spreadsheets = await upsertBatch("spreadsheets", backup.spreadsheets || []);
  stats.reminders = await upsertBatch("reminders", backup.reminders || []);
  stats.recurring_tasks = await upsertBatch("recurring_tasks", backup.recurring_tasks || []);
  stats.today_plans = await upsertBatch("today_plans", backup.today_plans || []);
  stats.mit_tasks = await upsertBatch("mit_tasks", backup.mit_tasks || [], false);
  stats.priority_tasks = await upsertBatch("priority_tasks", backup.priority_tasks || []);

  return jsonResponse({
    success: true,
    mode,
    restored: stats,
  });
}
