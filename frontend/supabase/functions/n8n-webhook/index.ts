import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, safeEqual } from "./utils.ts";
import { handleBackup } from "./handlers/backup.ts";
import { handleRestore } from "./handlers/restore.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-n8n-webhook-secret") ?? "";

    // Fail-closed: без конфигуриран secret функцията отказва ВСИЧКО.
    if (!webhookSecret) {
      console.error("N8N_WEBHOOK_SECRET is not configured — rejecting request");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    if (!safeEqual(providedSecret, webhookSecret)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();

    // Get user by email
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("email", payload.user_email)
      .maybeSingle();

    if (userError || !userData) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    const userId = userData.user_id;

    // Helper: verify project access
    async function verifyProject(projectId: string) {
      const { data, error } = await supabase
        .from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
      return data && !error ? data : null;
    }

    switch (payload.action) {
      // ==================== READ ====================

      case "list_projects": {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, description, color, icon, created_at, updated_at, archived_at")
          .eq("user_id", userId)
          .is("archived_at", null)
          .order("position");
        if (error) throw error;
        return jsonResponse({ success: true, projects: data });
      }

      case "get_project_data": {
        const project = await verifyProject(payload.project_id);
        if (!project) return jsonResponse({ error: "Project not found or access denied" }, 404);

        const [tasksRes, notesRes, spreadsheetsRes] = await Promise.all([
          supabase.from("tasks").select("*, task_tags(*)").eq("project_id", payload.project_id).is("archived_at", null).order("position"),
          supabase.from("notes").select("*").eq("project_id", payload.project_id).is("archived_at", null).order("created_at", { ascending: false }),
          supabase.from("spreadsheets").select("*").eq("project_id", payload.project_id).is("archived_at", null).order("created_at", { ascending: false }),
        ]);

        return jsonResponse({
          success: true,
          project_id: payload.project_id,
          tasks: tasksRes.data || [],
          notes: notesRes.data || [],
          spreadsheets: spreadsheetsRes.data || [],
        });
      }

      case "get_tasks": {
        const project = await verifyProject(payload.project_id);
        if (!project) return jsonResponse({ error: "Project not found or access denied" }, 404);

        let query = supabase.from("tasks").select("*, task_tags(*)").eq("project_id", payload.project_id).is("archived_at", null);
        if (payload.status) query = query.eq("status", payload.status);
        if (payload.priority) query = query.eq("priority", payload.priority);
        const { data, error } = await query.order("position");
        if (error) throw error;
        return jsonResponse({ success: true, tasks: data });
      }

      case "get_notes": {
        const project = await verifyProject(payload.project_id);
        if (!project) return jsonResponse({ error: "Project not found or access denied" }, 404);

        const { data, error } = await supabase
          .from("notes").select("*").eq("project_id", payload.project_id).is("archived_at", null)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResponse({ success: true, notes: data });
      }

      case "get_spreadsheets": {
        const project = await verifyProject(payload.project_id);
        if (!project) return jsonResponse({ error: "Project not found or access denied" }, 404);

        const { data, error } = await supabase
          .from("spreadsheets").select("*").eq("project_id", payload.project_id).is("archived_at", null)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResponse({ success: true, spreadsheets: data });
      }

      // ==================== WRITE ====================

      case "create_task": {
        const project = await verifyProject(payload.project_id);
        if (!project) return jsonResponse({ error: "Project not found or access denied" }, 404);

        const { data: maxPosData } = await supabase
          .from("tasks").select("position").eq("project_id", payload.project_id)
          .order("position", { ascending: false }).limit(1).maybeSingle();

        const { data: task, error } = await supabase
          .from("tasks")
          .insert({
            project_id: payload.project_id,
            title: payload.title,
            description: payload.description || null,
            priority: payload.priority || "medium",
            status: payload.status || "new",
            due_date: payload.due_date || null,
            position: (maxPosData?.position ?? 0) + 1,
            user_id: userId,
          })
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ success: true, task }, 201);
      }

      case "create_note": {
        const project = await verifyProject(payload.project_id);
        if (!project) return jsonResponse({ error: "Project not found or access denied" }, 404);

        const { data: note, error } = await supabase
          .from("notes")
          .insert({
            project_id: payload.project_id,
            title: payload.title,
            content: payload.content || "",
            user_id: userId,
          })
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ success: true, note }, 201);
      }

      case "update_task": {
        if (!payload.task_id) return jsonResponse({ error: "task_id is required" }, 400);

        const { data: taskData } = await supabase
          .from("tasks").select("id, project_id").eq("id", payload.task_id).maybeSingle();
        if (!taskData) return jsonResponse({ error: "Task not found" }, 404);

        const project = await verifyProject(taskData.project_id);
        if (!project) return jsonResponse({ error: "Access denied" }, 403);

        const updateFields: Record<string, unknown> = {};
        if (payload.title !== undefined) updateFields.title = payload.title;
        if (payload.description !== undefined) updateFields.description = payload.description;
        if (payload.status !== undefined) updateFields.status = payload.status;
        if (payload.priority !== undefined) updateFields.priority = payload.priority;
        if (payload.due_date !== undefined) updateFields.due_date = payload.due_date;

        if (Object.keys(updateFields).length === 0) {
          return jsonResponse({ error: "No fields to update" }, 400);
        }

        const { data: task, error } = await supabase
          .from("tasks").update(updateFields).eq("id", payload.task_id).select().single();
        if (error) throw error;
        return jsonResponse({ success: true, task });
      }

      // ==================== BACKUP & RESTORE ====================

      case "backup":
        return handleBackup(supabase, userId, payload.user_email);

      case "restore":
        return handleRestore(supabase, userId, payload);

      default:
        return jsonResponse({
          error: "Unknown action",
          available_actions: [
            "list_projects", "get_project_data",
            "get_tasks", "get_notes", "get_spreadsheets",
            "create_task", "create_note", "update_task",
            "backup", "restore",
          ],
        }, 400);
    }
  } catch (error) {
    console.error("Webhook error:", error);
    return jsonResponse({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
