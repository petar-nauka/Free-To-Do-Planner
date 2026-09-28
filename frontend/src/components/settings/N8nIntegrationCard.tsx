import { useState } from 'react';
import { Workflow, Copy, Check, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/n8n-webhook`;

interface PayloadExample {
  label: string;
  badge: 'read' | 'write';
  description: string;
  payload: string;
}

const examples: PayloadExample[] = [
  {
    label: 'Списък проекти',
    badge: 'read',
    description: 'Връща всички активни проекти на потребителя.',
    payload: `{
  "action": "list_projects",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Данни по проект (всичко)',
    badge: 'read',
    description: 'Връща задачи, бележки и таблици за конкретен проект — идеално за периодичен архив или ИИ анализ.',
    payload: `{
  "action": "get_project_data",
  "project_id": "your-project-uuid",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Задачи (с филтри)',
    badge: 'read',
    description: 'Филтриране по status (new, in_progress, future) и/или priority (low, medium, high).',
    payload: `{
  "action": "get_tasks",
  "project_id": "your-project-uuid",
  "status": "new",
  "priority": "high",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Бележки',
    badge: 'read',
    description: 'Връща всички активни бележки за проект.',
    payload: `{
  "action": "get_notes",
  "project_id": "your-project-uuid",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Таблици',
    badge: 'read',
    description: 'Връща всички активни таблици (spreadsheets) с данни и колони.',
    payload: `{
  "action": "get_spreadsheets",
  "project_id": "your-project-uuid",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Създаване на задача',
    badge: 'write',
    description: 'Създава нова задача в даден проект.',
    payload: `{
  "action": "create_task",
  "project_id": "your-project-uuid",
  "title": "Task from n8n",
  "description": "Created automatically",
  "priority": "high",
  "status": "new",
  "due_date": "2026-03-15",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Създаване на бележка',
    badge: 'write',
    description: 'Създава нова бележка в даден проект.',
    payload: `{
  "action": "create_note",
  "project_id": "your-project-uuid",
  "title": "Note from n8n",
  "content": "<p>HTML content here</p>",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Обновяване на задача',
    badge: 'write',
    description: 'Променя полета на съществуваща задача (title, description, status, priority, due_date).',
    payload: `{
  "action": "update_task",
  "task_id": "your-task-uuid",
  "status": "in_progress",
  "priority": "high",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Пълен backup (v2)',
    badge: 'read',
    description: 'Връща ВСИЧКО: проекти, задачи, тагове, бележки, таблици, напомняния, повтарящи се задачи, прикачени файлове, днешни планове, приоритетни задачи. Идеално за седмичен автоматичен архив.',
    payload: `{
  "action": "backup",
  "user_email": "your@email.com"
}`,
  },
  {
    label: 'Възстановяване от backup',
    badge: 'write',
    description: 'Възстановява данни от JSON backup. mode: "merge" (добавя/обновява, по подразбиране) или "replace" (изтрива всичко и възстановява).',
    payload: `{
  "action": "restore",
  "user_email": "your@email.com",
  "mode": "merge",
  "backup": { "...paste backup JSON here..." }
}`,
  },
];

export function N8nIntegrationCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast({
      title: 'Копирано!',
      description: `${label} е копиран в клипборда.`,
    });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="w-5 h-5" />
          n8n Интеграция
        </CardTitle>
        <CardDescription>
          Пълен достъп до проекти, задачи, бележки и таблици чрез n8n — за автоматизация, архиви и ИИ анализ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Webhook URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded-lg text-sm break-all">
              {WEBHOOK_URL}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => copyToClipboard(WEBHOOK_URL, 'Webhook URL')}
            >
              {copied === 'Webhook URL' ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Documentation Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="actions">
            <AccordionTrigger>Налични действия ({examples.length})</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {examples.map((ex, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{i + 1}. {ex.label}</h4>
                    <Badge variant={ex.badge === 'read' ? 'secondary' : 'default'} className="text-xs">
                      {ex.badge === 'read' ? 'GET' : 'WRITE'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{ex.description}</p>
                  <div className="relative">
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {ex.payload}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => copyToClipboard(ex.payload, ex.label)}
                    >
                      {copied === ex.label ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="setup">
            <AccordionTrigger>Как да настроите n8n</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <ol className="list-decimal list-inside space-y-2">
                <li>Създайте нов workflow в n8n</li>
                <li>Добавете HTTP Request node</li>
                <li>Задайте метод: <strong>POST</strong></li>
                <li>Добавете Webhook URL-а отгоре</li>
                <li>В Body изберете JSON и добавете payload-а</li>
                <li>
                  <strong>Задължително:</strong> Добавете header <code>x-n8n-webhook-secret</code> със
                  стойността на <code>N8N_WEBHOOK_SECRET</code> от сървъра. Без него заявките се отхвърлят (401).
                </li>
              </ol>
              <Button variant="link" className="p-0 h-auto" asChild>
                <a
                  href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  n8n HTTP Request документация
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="usecases">
            <AccordionTrigger>Примерни use cases</AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Периодичен архив:</strong> Вземи <code>get_project_data</code> и запиши в Google Docs / PDF</li>
                <li><strong>ИИ анализ:</strong> Подай данните на ИИ за решаване на задачи или приоритизиране</li>
                <li><strong>Email → Task:</strong> Препрати имейл към n8n и автоматично създай задача</li>
                <li><strong>Седмичен отчет:</strong> Вземи задачите, генерирай summary и изпрати по имейл</li>
                <li><strong>Slack → Note:</strong> Запази важни Slack съобщения като бележки</li>
                <li><strong>Пълен backup:</strong> Автоматичен backup всяка седмица в Google Drive</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
