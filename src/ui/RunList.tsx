import { useState } from "react";
import { Link } from "react-router-dom";
import type { Run } from "@/core/run";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { ProviderBadges } from "./ProviderBadges";
import { ProviderSelect } from "./ProviderSelect";
import { useProviderCatalog } from "./provider-catalog";

interface RunListProps {
  runs: Run[];
  status: string;
}

export function RunList({ runs, status }: RunListProps) {
  const catalog = useProviderCatalog();
  const [showComposer, setShowComposer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [lore, setLore] = useState("");
  const [conceptProvider, setConceptProvider] = useState<string | null>(null);
  const selectedConceptProvider = conceptProvider ?? catalog?.defaults.concept ?? "";

  const createRun = async () => {
    if (!selectedConceptProvider) return;
    setCreating(true);
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orientation,
          lore: lore.trim() || undefined,
          conceptProvider: selectedConceptProvider,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Create run failed (${response.status})`);
      }
      setLore("");
      setShowComposer(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-8 text-primary font-sans">
      <Header
        actions={
          <>
            <ProviderBadges />
            <div className="border-l border-border pl-4 text-sm font-medium">
              <span className="text-faint mr-2">API:</span>
              <span
                className={status === "connected" ? "text-status-ready" : "text-status-warning"}
              >
                {status}
              </span>
            </div>
          </>
        }
      />

      <main className="flex-1">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Active Runs</h2>
          <button
            type="button"
            onClick={() => setShowComposer((visible) => !visible)}
            className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover transition-colors"
          >
            {showComposer ? "Cancel" : "New Run"}
          </button>
        </div>

        {showComposer ? (
          <section
            className="mb-6 rounded-lg border border-accent/40 bg-surface p-5"
            aria-label="New run"
          >
            <h3 className="text-lg font-semibold">Authorize concept generation</h3>
            <p className="mt-1 text-sm text-secondary">
              Choose the provider that will be called when you generate concepts.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block space-y-1 text-sm">
                <span className="text-secondary">Orientation</span>
                <select
                  value={orientation}
                  onChange={(event) =>
                    setOrientation(event.target.value as "portrait" | "landscape")
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-primary focus:border-accent focus:outline-none"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <ProviderSelect
                capability="concept"
                label="Concept provider"
                options={catalog?.options ?? []}
                value={selectedConceptProvider}
                disabled={creating}
                onChange={setConceptProvider}
              />
              <label className="block space-y-1 text-sm">
                <span className="text-secondary">Lore (optional)</span>
                <input
                  value={lore}
                  onChange={(event) => setLore(event.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-primary focus:border-accent focus:outline-none"
                  placeholder="Campaign directive"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="rounded border border-border px-4 py-2 text-sm text-secondary hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createRun}
                disabled={creating || !selectedConceptProvider}
                className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
              >
                {creating ? "Starting..." : "Generate Concepts"}
              </button>
            </div>
          </section>
        ) : null}

        {runs.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-12 text-center text-secondary">
            No runs found. Start one above.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => (
              <Link
                key={run.id}
                to={`/runs/${run.id}`}
                className="group flex flex-col rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="font-mono text-xs text-faint transition-colors group-hover:text-primary">
                    {run.id}
                  </div>
                  <div
                    className={`rounded border border-border bg-surfaceRaised px-2 py-1 text-xs font-semibold capitalize ${["gate_a", "gate_a5", "gate_b"].includes(run.status) ? "text-status-warning" : run.status === "ready" ? "text-status-ready" : run.lastError ? "text-status-danger" : "text-status-rendering"}`}
                  >
                    {run.status.replace("_", " ")}
                  </div>
                </div>
                <h3 className="mb-1 line-clamp-2 text-lg font-medium text-primary">
                  {run.shotSpec?.imagePrompt
                    ? `${run.shotSpec.imagePrompt.split(".")[0]}...`
                    : (run.concept?.title ?? "Drafting Concept...")}
                </h3>
                <div className="mt-auto space-y-2 pt-4 text-xs text-secondary">
                  <div className="flex justify-between">
                    <span>Orientation:</span>
                    <span className="capitalize">{run.profile.orientation}</span>
                  </div>
                  {run.style ? (
                    <div className="flex justify-between">
                      <span>Style:</span>
                      <span>{run.style}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{new Date(run.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
