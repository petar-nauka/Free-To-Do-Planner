import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import Dashboard from "./pages/Dashboard";

// Таблото се зарежда веднага — то е първият екран. Останалите страници се
// свалят при първо отваряне („мързеливо"). Иначе всичко пристигаше в един
// файл от 2 MB, включително спортът и администрацията, които се отварят рядко.
const Auth = lazy(() => import("./pages/Auth"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const ArchivedProjects = lazy(() => import("./pages/ArchivedProjects"));
const Completed = lazy(() => import("./pages/Completed"));
const Sport = lazy(() => import("./pages/Sport"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30 сек „свежест": превключването на прозорци не тегли всичко от
      // сървъра всеки път. Промени през самото приложение се виждат веднага
      // (записът обновява кеша); промени от друго устройство — до 30 сек.
      staleTime: 30_000,
    },
  },
});

function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">{t("common.loading")}</p>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Грешка при рендер в която и да е страница → съобщение, не бял екран. */}
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                {/*
                  Постоянните адреси на проектите: /p/<проект>/<таб>/<елемент>.
                  Нарочно е ЕДИН маршрут със звезда, а не три отделни — така при
                  отваряне на бележка/задача Dashboard не се размонтира и редакторът
                  не се презарежда. Разбор на сегментите: `lib/deepLinks.ts`.
                */}
                <Route path="/p/:projectSegment/*" element={<Dashboard />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/archived" element={<ArchivedProjects />} />
                <Route path="/completed" element={<Completed />} />
                <Route path="/sport" element={<Sport />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
