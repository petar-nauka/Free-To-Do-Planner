import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../utils.ts";

export async function handleBackup(supabase: SupabaseClient, userId: string, userEmail: string) {
  const { data: projects } = await supabase
    .from("projects").select("*").eq("user_id", userId);
  const projectIds = projects?.map(p => p.id) || [];

  if (projectIds.length === 0) {
    return jsonResponse({
      success: true,
      backup: {
        exported_at: new Date().toISOString(),
        version: 2,
        user_email: userEmail,
        projects: [],
        tasks: [],
        task_tags: [],
        notes: [],
        spreadsheets: [],
        reminders: [],
        recurring_tasks: [],
        attachments: [],
        today_plans: [],
        mit_tasks: [],
        priority_tasks: [],
      },
    });
  }

  const [
    tasksRes, notesRes, spreadsheetsRes,
    remindersRes, recurringRes, attachmentsRes,
    todayPlansRes, priorityRes,
  ] = await Promise.all([
    supabase.from("tasks").select("*, task_tags(*)").in("project_id", projectIds),
    supabase.from("notes").select("*").in("project_id", projectIds),
    supabase.from("spreadsheets").select("*").in("project_id", projectIds),
    supabase.from("reminders").select("*").in("project_id", projectIds),
    supabase.from("recurring_tasks").select("*").in("project_id", projectIds),
    supabase.from("attachments").select("*").in("project_id", projectIds),
    supabase.from("today_plans").select("*").in("project_id", projectIds),
    supabase.from("priority_tasks").select("*").eq("user_id", userId),
  ]);

  // Collect all today_plan IDs to fetch mit_tasks
  const planIds = (todayPlansRes.data || []).map(p => p.id);
  let mitTasks: unknown[] = [];
  if (planIds.length > 0) {
    const { data } = await supabase.from("mit_tasks").select("*").in("today_plan_id", planIds);
    mitTasks = data || [];
  }

  // Separate task_tags from tasks
  const tasks = (tasksRes.data || []).map(t => {
    const { task_tags, ...task } = t;
    return task;
  });
  const taskTags = (tasksRes.data || []).flatMap(t => t.task_tags || []);

  return jsonResponse({
    success: true,
    backup: {
      exported_at: new Date().toISOString(),
      version: 2,
      user_email: userEmail,
      projects: projects || [],
      tasks,
      task_tags: taskTags,
      notes: notesRes.data || [],
      spreadsheets: spreadsheetsRes.data || [],
      reminders: remindersRes.data || [],
      recurring_tasks: recurringRes.data || [],
      attachments: attachmentsRes.data || [],
      today_plans: todayPlansRes.data || [],
      mit_tasks: mitTasks,
      priority_tasks: priorityRes.data || [],
    },
  });
}
