import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Предпазител срещу „бял екран": ако компонент под него хвърли грешка при
 * рендер, показва съобщение и бутон вместо да остави цялото приложение празно.
 *
 * Клас, а не хук — React дава `getDerivedStateFromError` само на класове.
 * Хваща само грешки при рендер; грешки в заявки/събития се обработват там,
 * където възникват (toast).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">Нещо се обърка</h1>
          <p className="text-sm text-muted-foreground">
            Тази част от приложението спря с грешка. Данните ти не са засегнати —
            те са на сървъра.
          </p>
          <pre className="text-xs text-left bg-muted rounded-xl p-3 overflow-auto max-h-40 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={this.reset} className="rounded-xl">
              Опитай пак
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl">
              Презареди страницата
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
