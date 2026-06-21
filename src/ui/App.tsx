import { useEffect, useState } from "react";

export function App() {
  const [status, setStatus] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setStatus(`API is ${data.status}`))
      .catch((err) => setStatus(`API error: ${err.message}`));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md w-full rounded-lg bg-surfaceRaised p-8 shadow-xl border border-border">
        <h1 className="mb-2 text-3xl font-bold text-accent">Candelabrum Studio</h1>
        <p className="mb-6 text-secondary font-mono text-sm tracking-tight">Phase 2 Dashboard</p>

        <div className="rounded bg-surface p-4 border border-border">
          <p className="text-sm font-medium">
            <span className="text-faint mr-2">Status:</span>
            <span className={status.includes("ok") ? "text-status-ready" : "text-status-warning"}>
              {status}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
