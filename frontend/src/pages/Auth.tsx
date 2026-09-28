import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Mail, Lock, User, ArrowRight, Sparkles, Key, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const REGISTRATION_CODE = 'N7f!q2Zp#8Lm';

export default function Auth() {
  const { t } = useTranslation();
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  const authSchema = z.object({
    email: z.string().email(t('auth.invalidCredentials')),
    password: z.string().min(6, t('auth.passwordMismatch')),
    displayName: z.string().optional(),
  });

  const signupSchema = authSchema.extend({
    registrationCode: z.string().min(1, t('common.error')),
  });

  type AuthFormData = z.infer<typeof authSchema>;
  type SignupFormData = z.infer<typeof signupSchema>;

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const loginForm = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', displayName: '', registrationCode: '' },
  });

  const handleLogin = async (data: AuthFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);

    if (error) {
      toast({
        title: t('auth.loginFailed'),
        description: error.message === 'Invalid login credentials' 
          ? t('auth.invalidCredentials')
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    if (data.registrationCode !== REGISTRATION_CODE) {
      toast({
        title: t('auth.registrationFailed'),
        description: t('common.error'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, data.displayName);
    setIsLoading(false);

    if (error) {
      toast({
        title: t('auth.registrationFailed'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('auth.welcome'),
        description: t('auth.registrationSuccess'),
      });
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      toast({
        title: t('common.error'),
        description: t('auth.enterEmailForReset'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsLoading(false);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('auth.resetEmailSent'),
        description: t('auth.resetEmailSentDesc'),
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        </div>

        <Card className="w-full max-w-md rounded-3xl border-border/50 shadow-soft relative">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-playful">
              <Mail className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              <span className="gradient-text">{t('auth.forgotPassword')}</span>
            </CardTitle>
            <CardDescription>
              {t('auth.forgotPasswordDesc')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t('common.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  className="pl-10 rounded-xl"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleForgotPassword}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {t('common.loading')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t('auth.sendResetEmail')}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowForgotPassword(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('auth.backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md rounded-3xl border-border/50 shadow-soft relative">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-playful">
            <FolderKanban className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            <span className="gradient-text">{t('auth.appDescription')}</span>
          </CardTitle>
          <CardDescription className="flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4" />
            {t('auth.appSubtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 mb-6">
              <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft">
                {t('auth.signIn')}
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft">
                {t('auth.signUp')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t('common.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      className="pl-10 rounded-xl"
                      {...loginForm.register('email')}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">{t('common.password')}</Label>
                    <Button 
                      type="button" 
                      variant="link" 
                      className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      {t('auth.forgotPassword')}
                    </Button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 rounded-xl"
                      {...loginForm.register('password')}
                    />
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      {t('common.loading')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {t('auth.signIn')}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t('common.name')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder={t('common.name')}
                      className="pl-10 rounded-xl"
                      {...signupForm.register('displayName')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('common.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      className="pl-10 rounded-xl"
                      {...signupForm.register('email')}
                    />
                  </div>
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('common.password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 rounded-xl"
                      {...signupForm.register('password')}
                    />
                  </div>
                  {signupForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-code">{t('common.password')}</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-code"
                      type="password"
                      placeholder={t('common.password')}
                      className="pl-10 rounded-xl"
                      {...signupForm.register('registrationCode')}
                    />
                  </div>
                  {signupForm.formState.errors.registrationCode && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.registrationCode.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      {t('common.loading')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {t('auth.signUp')}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
