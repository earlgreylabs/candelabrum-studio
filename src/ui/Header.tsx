import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import logo from "./assets/candelabrum-studio.png";

interface HeaderProps {
  /**
   * When set, the left zone shows a back link (arrow + label) instead of the brand
   * lockup — used on inner pages where navigating up matters more than branding.
   */
  back?: { to: string; label: string };
  /** Left-side context shown after the brand/back — e.g. a run id or breadcrumb. */
  context?: ReactNode;
  /** Right-aligned page actions — status badges, controls, provider badges. */
  actions?: ReactNode;
}

/**
 * Shared studio header rendered on every page. The home page shows the brand lockup
 * (logo links home); inner pages pass `back` to swap it for an up-navigation link.
 * Pages fill the `context` (breadcrumb) and `actions` (controls) slots themselves.
 */
export function Header({ back, context, actions }: HeaderProps) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-4">
      <div className="flex min-w-0 items-center gap-4">
        {back ? (
          <Link
            to={back.to}
            className="group flex shrink-0 items-center gap-2 rounded text-secondary outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span
              aria-hidden
              className="text-lg leading-none transition-transform group-hover:-translate-x-0.5"
            >
              &larr;
            </span>
            <span className="font-medium">{back.label}</span>
          </Link>
        ) : (
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Candelabrum Studio home"
          >
            <img
              src={logo}
              alt=""
              className="h-14 w-14 shrink-0 object-contain transition-transform group-hover:scale-105"
            />
            <span className="flex flex-col leading-none">
              <span className="text-2xl font-bold text-accent transition-colors group-hover:text-accent-hover">
                Candelabrum
              </span>
              <span className="text-xl font-medium tracking-wide text-accent-hover">Studio</span>
            </span>
          </Link>
        )}
        {context ? (
          <div className="flex min-w-0 items-center gap-4 border-l border-border pl-4">
            {context}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-4">{actions}</div> : null}
    </header>
  );
}
