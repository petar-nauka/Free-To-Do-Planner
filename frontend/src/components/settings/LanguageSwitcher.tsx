import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const languages = [
  { code: 'bg', name: 'Български', flag: '🇧🇬' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem('language', value);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          {t('settings.language')}
        </CardTitle>
        <CardDescription>
          {t('settings.languageDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code} className="rounded-lg">
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
