import { supabase } from '@/integrations/supabase/client';

/**
 * Triggers the notification processing edge function
 * This should be called after creating tasks/notes in shared projects
 */
export async function processNotifications(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('process-notifications');
    if (error) {
      console.error('Error processing notifications:', error);
    }
  } catch (error) {
    console.error('Failed to invoke process-notifications:', error);
  }
}
