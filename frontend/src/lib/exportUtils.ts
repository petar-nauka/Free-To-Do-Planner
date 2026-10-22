import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import type { Project } from '@/hooks/useProjects';
import type { Note } from '@/hooks/useNotes';
import type { Task } from '@/hooks/useTasks';

// Zod schema for backup validation
const BackupProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  color: z.string().max(50),
  icon: z.string().max(50),
  position: z.number().int().min(0).optional(),
  user_id: z.string().uuid(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  archived_at: z.string().nullable().optional(),
});

const BackupNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string().max(50000).nullable().optional(),
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const BackupTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(50),
});

const BackupTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(['new', 'in_progress', 'future']),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().nullable().optional(),
  position: z.number().int().min(0),
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  note_id: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  archived_at: z.string().nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  tags: z.array(BackupTagSchema).optional(),
  task_tags: z.array(BackupTagSchema).optional(),
});

const BackupDataSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  projects: z.array(BackupProjectSchema).max(100),
  notes: z.array(BackupNoteSchema).max(1000),
  tasks: z.array(BackupTaskSchema).max(1000),
});

export interface BackupData {
  version: string;
  exportedAt: string;
  projects: Project[];
  notes: Note[];
  tasks: (Task & { tags?: { name: string; color: string }[] })[];
}

export async function fetchAllUserData(userId: string): Promise<BackupData> {
  const [projectsRes, notesRes, tasksRes] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', userId),
    supabase.from('notes').select('*').eq('user_id', userId),
    supabase.from('tasks').select('*, task_tags(*)').eq('user_id', userId),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (notesRes.error) throw notesRes.error;
  if (tasksRes.error) throw tasksRes.error;

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projects: projectsRes.data as Project[],
    notes: notesRes.data as Note[],
    tasks: tasksRes.data.map((t: any) => ({
      ...t,
      tags: t.task_tags?.map((tag: any) => ({ name: tag.name, color: tag.color })),
    })),
  };
}

export function exportToJSON(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `projecthub-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFromJSON(
  file: File,
  userId: string
): Promise<{ projects: number; notes: number; tasks: number }> {
  const text = await file.text();
  
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format');
  }

  // Validate with Zod schema
  const validationResult = BackupDataSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid backup file: ${errors}`);
  }

  const data = validationResult.data;

  let projectsImported = 0;
  let notesImported = 0;
  let tasksImported = 0;

  // Create ID mapping for projects
  const projectIdMap = new Map<string, string>();

  // Import projects
  for (const project of data.projects) {
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
      })
      .select()
      .single();

    if (!error && newProject) {
      projectIdMap.set(project.id, newProject.id);
      projectsImported++;
    }
  }

  // Import notes
  for (const note of data.notes) {
    const newProjectId = projectIdMap.get(note.project_id);
    if (newProjectId) {
      const { error } = await supabase.from('notes').insert({
        user_id: userId,
        project_id: newProjectId,
        title: note.title,
        content: note.content,
      });
      if (!error) notesImported++;
    }
  }

  // Import tasks
  for (const task of data.tasks) {
    const newProjectId = projectIdMap.get(task.project_id);
    if (newProjectId) {
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          project_id: newProjectId,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          position: task.position,
          color: task.color ?? null,
        })
        .select()
        .single();

      if (!error && newTask) {
        tasksImported++;

        // Import tags
        if (task.tags && task.tags.length > 0) {
          await supabase.from('task_tags').insert(
            task.tags.map((tag) => ({
              task_id: newTask.id,
              name: tag.name,
              color: tag.color,
            }))
          );
        }
      }
    }
  }

  return { projects: projectsImported, notes: notesImported, tasks: tasksImported };
}

export function generateProjectPDF(
  project: Project,
  notes: Note[],
  tasks: Task[]
): void {
  // Create a printable HTML document
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Please allow popups to export PDF');
  }

  const priorityColors: Record<string, string> = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    new: 'New Tasks',
    in_progress: 'In Progress',
    future: 'Future',
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${project.name} - ProjectHub Export</title>
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          color: #1a1a1a;
          line-height: 1.6;
        }
        h1 { 
          color: #6366f1; 
          border-bottom: 3px solid #6366f1;
          padding-bottom: 10px;
        }
        h2 { 
          color: #4f46e5;
          margin-top: 30px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 8px;
        }
        h3 { 
          color: #6b7280;
          margin-top: 24px;
        }
        .note { 
          background: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          margin: 12px 0;
          border-left: 4px solid #6366f1;
        }
        .note-title { 
          font-weight: 600;
          margin-bottom: 8px;
        }
        .note-content { 
          color: #4b5563;
        }
        .task { 
          background: #f9fafb;
          padding: 12px 16px;
          border-radius: 8px;
          margin: 8px 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .priority-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .task-title { font-weight: 500; }
        .task-meta { 
          font-size: 0.875rem;
          color: #6b7280;
          margin-top: 4px;
        }
        .tag {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 0.75rem;
          margin-right: 4px;
        }
        .empty { 
          color: #9ca3af;
          font-style: italic;
        }
        @media print {
          body { padding: 20px; }
          .note, .task { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>${project.name}</h1>
      ${project.description ? `<p>${project.description}</p>` : ''}
      
      <h2>📝 Notes</h2>
      ${notes.length === 0 
        ? '<p class="empty">No notes in this project</p>' 
        : notes.map(note => `
          <div class="note">
            <div class="note-title">${note.title}</div>
            <div class="note-content">${note.content || '<em>Empty note</em>'}</div>
          </div>
        `).join('')}
      
      <h2>✅ Tasks</h2>
      ${['new', 'in_progress', 'future'].map(status => {
        const statusTasks = tasks.filter(t => t.status === status);
        return `
          <h3>${statusLabels[status]} (${statusTasks.length})</h3>
          ${statusTasks.length === 0 
            ? '<p class="empty">No tasks</p>'
            : statusTasks.map(task => `
              <div class="task">
                <div class="priority-dot" style="background: ${priorityColors[task.priority]}"></div>
                <div>
                  <div class="task-title">${task.title}</div>
                  ${task.description ? `<div class="task-meta">${task.description}</div>` : ''}
                  ${task.due_date ? `<div class="task-meta">Due: ${new Date(task.due_date).toLocaleDateString()}</div>` : ''}
                  ${task.task_tags && task.task_tags.length > 0 
                    ? `<div class="task-meta">${task.task_tags.map(t => 
                        `<span class="tag" style="background: ${t.color}20; color: ${t.color}">${t.name}</span>`
                      ).join('')}</div>` 
                    : ''}
                </div>
              </div>
            `).join('')}
        `;
      }).join('')}
      
      <p style="margin-top: 40px; color: #9ca3af; font-size: 0.875rem; text-align: center;">
        Exported from ProjectHub on ${new Date().toLocaleString()}
      </p>
      
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
