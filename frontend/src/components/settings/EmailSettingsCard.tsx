import { useState, useEffect } from 'react';
import { Mail, Eye, EyeOff, Loader2, Save, SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function EmailSettingsCard() {
  const { settings, loading, updateSetting, getSetting } = useAppSettings();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  
  const [formData, setFormData] = useState({
    EMAIL_GATEWAY_URL: '',
    EMAIL_GATEWAY_API_KEY: '',
    email_from_name: '',
    email_from_address: '',
    email_reply_to: '',
    email_notifications_enabled: 'false',
  });

  useEffect(() => {
    if (!loading && settings.length > 0) {
      const getValue = (key: string) => {
        const setting = settings.find(s => s.key === key);
        return setting?.value ?? '';
      };
      
      setFormData({
        EMAIL_GATEWAY_URL: getValue('EMAIL_GATEWAY_URL'),
        EMAIL_GATEWAY_API_KEY: getValue('EMAIL_GATEWAY_API_KEY'),
        email_from_name: getValue('email_from_name'),
        email_from_address: getValue('email_from_address'),
        email_reply_to: getValue('email_reply_to'),
        email_notifications_enabled: getValue('email_notifications_enabled') || 'false',
      });
    }
  }, [loading, settings]);

  useEffect(() => {
    if (user?.email && !testEmail) {
      setTestEmail(user.email);
    }
  }, [user?.email]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        updateSetting('EMAIL_GATEWAY_URL', formData.EMAIL_GATEWAY_URL),
        updateSetting('EMAIL_GATEWAY_API_KEY', formData.EMAIL_GATEWAY_API_KEY),
        updateSetting('email_from_name', formData.email_from_name),
        updateSetting('email_from_address', formData.email_from_address),
        updateSetting('email_reply_to', formData.email_reply_to),
        updateSetting('email_notifications_enabled', formData.email_notifications_enabled),
      ]);
      
      toast({
        title: 'Настройките са запазени',
        description: 'Email настройките бяха успешно обновени.',
      });
    } catch (error) {
      toast({
        title: 'Грешка',
        description: 'Неуспешно запазване на настройките.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: 'Грешка',
        description: 'Моля, въведете email адрес за теста.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.EMAIL_GATEWAY_URL || !formData.EMAIL_GATEWAY_API_KEY) {
      toast({
        title: 'Грешка',
        description: 'Моля, конфигурирайте Gateway URL и API Key преди теста.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { recipientEmail: testEmail },
      });

      if (error) throw error;

      toast({
        title: 'Тестов имейл изпратен!',
        description: `Имейлът беше изпратен успешно до ${testEmail}`,
      });
    } catch (error: any) {
      console.error('Test email error:', error);
      toast({
        title: 'Грешка при изпращане',
        description: error.message || 'Неуспешно изпращане на тестов имейл.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Gateway настройки
        </CardTitle>
        <CardDescription>
          Конфигурирайте настройките за изпращане на имейли
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="gateway-url">Gateway URL</Label>
          <Input
            id="gateway-url"
            type="url"
            placeholder="https://api.example.com/send"
            value={formData.EMAIL_GATEWAY_URL}
            onChange={(e) => setFormData(prev => ({ ...prev, EMAIL_GATEWAY_URL: e.target.value }))}
            className="rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key">API Key</Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showApiKey ? 'text' : 'password'}
              placeholder="Въведете API ключ"
              value={formData.EMAIL_GATEWAY_API_KEY}
              onChange={(e) => setFormData(prev => ({ ...prev, EMAIL_GATEWAY_API_KEY: e.target.value }))}
              className="rounded-xl pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from-name">Име на подател</Label>
            <Input
              id="from-name"
              placeholder="TaskFlow App"
              value={formData.email_from_name}
              onChange={(e) => setFormData(prev => ({ ...prev, email_from_name: e.target.value }))}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="from-address">Email на подател</Label>
            <Input
              id="from-address"
              type="email"
              placeholder="noreply@example.com"
              value={formData.email_from_address}
              onChange={(e) => setFormData(prev => ({ ...prev, email_from_address: e.target.value }))}
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reply-to">Reply-To адрес</Label>
          <Input
            id="reply-to"
            type="email"
            placeholder="support@example.com"
            value={formData.email_reply_to}
            onChange={(e) => setFormData(prev => ({ ...prev, email_reply_to: e.target.value }))}
            className="rounded-xl"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <Label htmlFor="notifications-enabled" className="font-medium">
              Активирай известия
            </Label>
            <p className="text-sm text-muted-foreground">
              Изпращай email известия на потребителите
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={formData.email_notifications_enabled === 'true'}
            onCheckedChange={(checked) => 
              setFormData(prev => ({ ...prev, email_notifications_enabled: checked ? 'true' : 'false' }))
            }
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="flex-1 rounded-xl"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Запази настройките
          </Button>
        </div>

        {/* Test Email Section */}
        <div className="pt-4 border-t border-border space-y-3">
          <Label className="font-medium">Изпрати тестов имейл</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="rounded-xl flex-1"
            />
            <Button
              onClick={handleSendTestEmail}
              disabled={isSendingTest || !formData.EMAIL_GATEWAY_URL || !formData.EMAIL_GATEWAY_API_KEY}
              variant="outline"
              className="rounded-xl"
            >
              {isSendingTest ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <SendHorizontal className="w-4 h-4 mr-2" />
              )}
              Изпрати тест
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Изпратете тестов имейл, за да проверите дали настройките са правилни.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
