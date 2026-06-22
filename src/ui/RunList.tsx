import { Link } from "react-router-dom";
import type { Run } from "@/core/run";

interface RunListProps {
  runs: Run[];
  status: string;
}

export function RunList({ runs, status }: RunListProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background p-8 text-primary font-sans">
      <header className="mb-8 flex items-end justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold text-accent">Candelabrum Studio</h1>
          <p className="text-secondary font-mono text-sm tracking-tight">v1 Dashboard</p>
        </div>
        <div className="text-sm font-medium">
          <span className="text-faint mr-2">API:</span>
          <span className={status === "connected" ? "text-status-ready" : "text-status-warning"}>
            {status}
          </span>
        </div>
      </header>

      <main className="flex-1">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Active Runs</h2>
          <button
            type="button"
            onClick={async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.innerText = "Creating...";
              try {
                await fetch("/api/runs", { method: "POST" });
              } catch (err) {
                console.error("Failed to create run", err);
              } finally {
                btn.disabled = false;
                btn.innerText = "New Run";
              }
            }}
            className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            New Run
          </button>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-12 text-center text-secondary">
            No runs found. Start one using the CLI.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => (
              <Link
                key={run.id}
                to={`/runs/${run.id}`}
                className="flex flex-col rounded-lg border border-border bg-surface p-5 shadow-sm hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="font-mono text-xs text-faint group-hover:text-primary transition-colors">
                    {run.id}
                  </div>
                  <div
                    className={`rounded bg-surfaceRaised px-2 py-1 text-xs font-semibold capitalize border border-border ${
                      ["gate_a", "gate_a5", "gate_b"].includes(run.status)
                        ? "text-status-warning animate-pulse"
                        : ["ready"].includes(run.status)
                          ? "text-status-ready"
                          : "text-status-rendering"
                    }`}
                  >
                    {run.status.replace("_", " ")}
                  </div>
                </div>

                <h3 className="mb-1 text-lg font-medium text-primary line-clamp-2">
                  {run.shotSpec?.imagePrompt
                    ? `${run.shotSpec.imagePrompt.split(".")[0]}...`
                    : "Drafting Concept..."}
                </h3>

                <div className="mt-auto pt-4 space-y-2">
                  <div className="flex justify-between text-xs text-secondary">
                    <span>Orientation:</span>
                    <span className="capitalize">{run.profile.orientation}</span>
                  </div>
                  {run.style && (
                    <div className="flex justify-between text-xs text-secondary">
                      <span>Style:</span>
                      <span>{run.style}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-secondary">
                    <span>Created:</span>
                    <span>{new Date(run.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
