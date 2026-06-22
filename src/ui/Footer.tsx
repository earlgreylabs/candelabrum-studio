/**
 * Shared studio footer. Holds the version/build line that used to sit under the
 * wordmark, freeing the header brand to read as a clean two-line lockup. `mt-auto`
 * pins it to the bottom of the page's flex column regardless of content height.
 */
export function Footer() {
  return (
    <footer className="mt-auto flex items-center justify-between border-t border-border pt-4 font-mono text-xs tracking-tight text-faint">
      <span>Candelabrum Studio</span>
      <span>v1 Dashboard</span>
    </footer>
  );
}
