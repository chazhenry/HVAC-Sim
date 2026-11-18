import { type ReactNode, useState } from 'react';

/**
 * A card whose body folds away behind a chevron. `summary` stays visible when
 * it is collapsed. `actions` (small icon buttons) sit in the header, left of the
 * chevron. The open/closed choice is remembered per card in the browser.
 */
export function CollapsibleCard(props: {
  id: string;
  title: string;
  /** Shown after the title in the accent colour, e.g. what the card currently holds. */
  detail?: string;
  summary?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const { id, title, detail, summary, actions, className, children } = props;
  const key = `hvac-sim.card.${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(key) !== 'closed';
    } catch {
      return true;
    }
  });
  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(key, next ? 'open' : 'closed');
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  };
  const label = `${open ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`;
  return (
    <section className={className ? `card ${className}` : 'card'}>
      <div className="card-head">
        <button
          type="button"
          className="card-toggle"
          aria-expanded={open}
          aria-controls={`card-${id}`}
          title={label}
          onClick={toggle}
        >
          <h2>
            {title}
            {detail && (
              <>
                : <span className="card-detail">{detail}</span>
              </>
            )}
          </h2>
        </button>
        {actions}
        {/* Same toggle as the title; hidden from the keyboard and screen readers so it is announced once. */}
        <button type="button" className="card-toggle card-chev" tabIndex={-1} aria-hidden="true" title={label} onClick={toggle}>
          <svg className={open ? 'chev open' : 'chev'} viewBox="0 0 16 16" width={14} height={14}>
            <path d="M3 6 L8 11 L13 6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {summary}
      {open && (
        <div id={`card-${id}`} className="card-body">
          {children}
        </div>
      )}
    </section>
  );
}
