import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin, useUsers } from '@/hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Users, Shield, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileUploadSettingsCard } from '@/components/settings/FileUploadSettingsCard';

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { users, loading: usersLoading, refetch } = useUsers();
  const { toast } = useToast();
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, adminLoading, navigate]);

  const handleDeleteUser = async (userIdToDelete: string) => {
    setDeletingUserId(userIdToDelete);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Грешка',
          description: 'Не сте влезли в системата',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userIdToDelete },
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Успех',
        description: 'Потребителят е изтрит успешно',
      });

      refetch();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Грешка',
        description: error.message || 'Неуспешно изтриване на потребител',
        variant: 'destructive',
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    setUpdatingRoleUserId(userId);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-user-role', {
        body: { userId, newRole },
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Успех',
        description: newRole === 'admin' ? 'Потребителят е администратор' : 'Потребителят е обикновен потребител',
      });

      refetch();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Грешка',
        description: error.message || 'Неуспешна промяна на роля',
        variant: 'destructive',
      });
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              <span className="gradient-text">Администрация</span>
            </h1>
            <p className="text-muted-foreground">Управление на потребители и настройки</p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Общо потребители
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{users.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Администратори
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Обикновени потребители</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {users.filter(u => u.role === 'user').length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Регистрирани потребители</CardTitle>
              <CardDescription>Списък на всички потребители в системата</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Име</TableHead>
                      <TableHead>Имейл</TableHead>
                      <TableHead>Роля</TableHead>
                      <TableHead>Регистриран на</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">
                          {u.display_name || '-'}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          {u.user_id === user?.id ? (
                            <Badge variant="default">Администратор</Badge>
                          ) : (
                            <Select
                              value={u.role}
                              onValueChange={(value: 'admin' | 'user') => handleRoleChange(u.user_id, value)}
                              disabled={updatingRoleUserId === u.user_id}
                            >
                              <SelectTrigger className="w-[160px]">
                                {updatingRoleUserId === u.user_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Администратор</SelectItem>
                                <SelectItem value="user">Потребител</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(u.created_at), 'dd.MM.yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          {u.user_id !== user?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={deletingUserId === u.user_id}
                                >
                                  {deletingUserId === u.user_id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Изтриване на потребител?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Това ще изтрие завинаги "{u.display_name || u.email}" и всички свързани данни. 
                                    Това действие не може да бъде отменено.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отказ</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(u.user_id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Изтрий
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* File Upload Settings */}
          <FileUploadSettingsCard />
        </div>
      </div>
    </div>
  );
}
