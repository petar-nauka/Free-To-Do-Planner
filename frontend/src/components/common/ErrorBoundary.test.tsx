import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('бум в компонента');
  return <div>всичко е наред</div>;
}

describe('ErrorBoundary', () => {
  // React пише хванатата грешка в console.error, а jsdom я докладва и като
  // „Uncaught" събитие на window — и двете са очаквани, не замърсяваме изхода.
  const swallow = (e: Event) => e.preventDefault();
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('error', swallow);
  });
  afterEach(() => {
    window.removeEventListener('error', swallow);
    vi.restoreAllMocks();
  });

  it('показва децата си, когда няма грешка', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('всичко е наред')).toBeInTheDocument();
  });

  it('при грешка показва съобщение вместо бял екран', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Нещо се обърка')).toBeInTheDocument();
    expect(screen.getByText(/бум в компонента/)).toBeInTheDocument();
    expect(screen.queryByText('всичко е наред')).not.toBeInTheDocument();
  });

  it('„Опитай пак" рендерира децата отново', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Нещо се обърка')).toBeInTheDocument();

    // Причината е отстранена, но границата още помни грешката —
    // чак бутонът я нулира.
    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Нещо се обърка')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Опитай пак' }));
    expect(screen.getByText('всичко е наред')).toBeInTheDocument();
  });
});
