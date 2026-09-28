import type { SportContent } from '@/lib/sportTypes';

/** Статичният наръчник — правилата и бележката за безопасност. */
export function SportRules({ content }: { content: SportContent }) {
  return (
    <section className="section" style={{ borderTop: 0 }}>
      <div className="section-intro">
        <p className="eyebrow">Кратък наръчник</p>
        <h2>Правилата, които държат плана прост</h2>
      </div>

      <div className="rules-grid">
        {content.rules.map((r) => (
          <article key={r.n}>
            <span>{r.n}</span>
            <h3>{r.h}</h3>
            <p>{r.p}</p>
          </article>
        ))}
      </div>

      <div className="safety">
        <strong>{content.safety.h}</strong>
        <p>{content.safety.p}</p>
      </div>
    </section>
  );
}
