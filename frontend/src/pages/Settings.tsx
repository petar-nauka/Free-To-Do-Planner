import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Download, 
  Upload, 
  FileJson, 
  Moon, 
  Sun, 
  User,
  Shield,
  Trash2,
  Loader2,
  Archive,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { fetchAllUserData, exportToJSON, importFromJSON } from '@/lib/exportUtils';
import { N8nIntegrationCard } from '@/components/settings/N8nIntegrationCard';
import { EmailSettingsCard } from '@/components/settings/EmailSettingsCard';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { TodayPlanSettingsCard } from '@/components/settings/TodayPlanSettingsCard';
import { SportSettingsCard } from '@/components/settings/SportSettingsCard';
import { ProjectIdsCard } from '@/components/settings/ProjectIdsCard';
import { OverdueTasksSettingsCard } from '@/components/settings/OverdueTasksSettingsCard';
import { WeeklyReportSettingsCard } from '@/components/settings/WeeklyReportSettingsCard';
import { StaleTasksEmailSettingsCard } from '@/components/settings/StaleTasksEmailSettingsCard';
import AiIntegrationCard from '@/components/settings/AiIntegrationCard';

export default function Settings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleExportBackup = async () => {
    if (!user) return;
    
    setIsExporting(true);
    try {
      const data = await fetchAllUserData(user.id);
      exportToJSON(data);
      toast({
        title: t('common.success'),
        description: `${t('common.export')}: ${data.projects.length} ${t('nav.projects').toLowerCase()}, ${data.notes.length} ${t('nav.notes').toLowerCase()}, ${data.tasks.length} ${t('nav.tasks').toLowerCase()}.`,
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    try {
      const result = await importFromJSON(file, user.id);
      toast({
        title: t('common.success'),
        description: `${t('common.import')}: ${result.projects} ${t('nav.projects').toLowerCase()}, ${result.notes} ${t('nav.notes').toLowerCase()}, ${result.tasks} ${t('nav.tasks').toLowerCase()}.`,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 bg-card border-b border-border px-4 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/')}
          className="rounded-xl"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('settings.title')}</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Language Section */}
        <LanguageSwitcher />

        {/* Today Plan Settings */}
        <TodayPlanSettingsCard />

        {/* Спорт — дневник за тренировки (изключен по подразбиране) */}
        <SportSettingsCard />

        {/* Overdue Task Notifications */}
        <OverdueTasksSettingsCard />

        {/* Weekly Email Report */}
        <WeeklyReportSettingsCard />

        {/* Седмичен имейл за задачи, непипани 30+ дни */}
        <StaleTasksEmailSettingsCard />

        {/* Account Section */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('common.profile')}
            </CardTitle>
            <CardDescription>{t('common.email')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('common.email')}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              {t('settings.theme')}
            </CardTitle>
            <CardDescription>{t('settings.themeDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label htmlFor="dark-mode" className="font-medium">{t('settings.dark')}</Label>
              </div>
              <Switch 
                id="dark-mode" 
                checked={isDark} 
                onCheckedChange={toggleTheme}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data & Backup Section */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              {t('common.export')} / {t('common.import')}
            </CardTitle>
            <CardDescription>{t('common.export')} {t('common.and')} {t('common.import')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleExportBackup}
                disabled={isExporting}
                className="flex-1 rounded-xl"
                variant="outline"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {t('common.export')} (JSON)
              </Button>
              
              <div className="flex-1">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                  id="import-backup"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full rounded-xl"
                  variant="outline"
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {t('common.import')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Archived Projects */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Архивирани проекти
            </CardTitle>
            <CardDescription>Преглед на архивирани проекти</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full rounded-xl justify-between"
              onClick={() => navigate('/settings/archived')}
            >
              <span>Виж архивираните проекти</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Project IDs for n8n */}
        <ProjectIdsCard />

        {/* n8n Integration */}
        <N8nIntegrationCard />

        {/* AI & Voice Settings */}
        <AiIntegrationCard />

        {/* Email Settings - Admin Only */}
        {isAdmin && <EmailSettingsCard />}

        {/* Danger Zone */}
        <Card className="rounded-2xl border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="w-5 h-5" />
              {t('common.warning')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="rounded-xl">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('common.logout')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('common.logout')}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('auth.loginDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleSignOut}
                    className="rounded-xl bg-destructive hover:bg-destructive/90"
                  >
                    {t('common.logout')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
