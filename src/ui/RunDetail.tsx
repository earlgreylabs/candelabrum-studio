import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Run, RunStatus } from "@/core/run";

// Manual (ManualInbox) stages pause the run until the operator drops a file into
// an inbox directory. These mirror the paths the adapters create on disk.
const MANUAL_DROP: Partial<
  Record<RunStatus, { label: string; accepts: string; dir: (id: string) => string }>
> = {
  imaging: { label: "image", accepts: ".png / .jpg", dir: (id) => `runs/${id}/inbox` },
  animating: { label: "video", accepts: ".mp4 / .mov", dir: (id) => `renders/raw/${id}-inbox` },
};

const TERMINAL_STATUSES: RunStatus[] = ["ready", "rejected", "failed"];
const GATE_STATUSES: RunStatus[] = ["gate_a", "gate_a5", "gate_b"];

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `${fallback} (HTTP ${res.status})`;
}

export function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [reviseInstruction, setReviseInstruction] = useState("");
  const [editedCaption, setEditedCaption] = useState("");

  const fetchRun = useCallback(() => {
    fetch(`/api/runs/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Run not found");
        return res.json();
      })
      .then((data) => {
        setRun(data.run);
        if (data.run.shotSpec?.captionDraft) {
          setEditedCaption((prev) => prev || data.run.shotSpec.captionDraft);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // While the run is mid-pipeline (e.g. awaiting a manual drop), poll so the view
  // reflects stage transitions without a manual refresh.
  useEffect(() => {
    if (!run) return;
    const processing =
      !GATE_STATUSES.includes(run.status) && !TERMINAL_STATUSES.includes(run.status);
    if (!processing) return;
    const interval = setInterval(fetchRun, 2500);
    return () => clearInterval(interval);
  }, [run, fetchRun]);

  const handleAction = async (action: "advance" | "reject") => {
    if (!run) return;
    setActionLoading(true);
    try {
      const body =
        action === "advance" && run.status === "gate_b"
          ? JSON.stringify({ caption: editedCaption })
          : undefined;

      const res = await fetch(`/api/runs/${run.id}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      if (!res.ok) {
        throw new Error(await errorMessage(res, "Action failed"));
      }
      navigate("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setActionLoading(false);
    }
  };

  const handleRevise = async () => {
    if (!run || !reviseInstruction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: reviseInstruction }),
      });
      if (!res.ok) {
        throw new Error(await errorMessage(res, "Revise failed"));
      }
      setReviseInstruction("");
      fetchRun(); // Re-fetch to show new concept
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/regenerate`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await errorMessage(res, "Regenerate failed"));
      }
      navigate("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-primary">Loading...</div>;
  if (error || !run) return <div className="p-8 text-status-danger">{error || "Not found"}</div>;

  const isGate = ["gate_a", "gate_a5", "gate_b"].includes(run.status);
  const drop = MANUAL_DROP[run.status];
  const totalCost = run.cost.reduce((sum, c) => sum + c.amountUsd, 0);
  // Stable keys for the (static, append-only) ledger without keying on the index.
  const costRows = run.cost.map((entry, idx) => ({ entry, key: `${entry.stage}-${idx}` }));

  return (
    <div className="flex min-h-screen flex-col bg-background p-8 text-primary font-sans">
      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-secondary hover:text-primary transition-colors">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold font-mono">{run.id}</h1>
        </div>
        <div
          className={`rounded bg-surfaceRaised px-3 py-1 text-sm font-semibold capitalize border border-border ${
            isGate
              ? "text-status-warning"
              : ["ready"].includes(run.status)
                ? "text-status-ready"
                : "text-status-rendering"
          }`}
        >
          {run.status.replace("_", " ")}
        </div>
      </header>

      <main className="flex-1 grid gap-8 md:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          {/* Awaiting manual drop (ManualInbox stages) */}
          {drop && (
            <div className="rounded-lg border border-accent/40 bg-surface p-6 space-y-3">
              <h3 className="text-lg font-medium text-accent border-b border-border pb-2">
                Awaiting manual {drop.label}
              </h3>
              <p className="text-sm text-secondary">
                This stage uses a manual inbox. Drop the {drop.label} ({drop.accepts}) into:
              </p>
              <code className="block break-all rounded border border-border bg-background p-3 font-mono text-sm text-primary">
                {drop.dir(run.id)}/
              </code>
              <p className="text-xs text-secondary">
                The run advances automatically once the file lands.
              </p>
            </div>
          )}

          {/* Concept Display (Gate A) */}
          {run.concept && (
            <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
              <h3 className="text-lg font-medium text-accent border-b border-border pb-2">
                Concept Draft
              </h3>
              <div>
                <h4 className="text-sm text-secondary mb-1">Title</h4>
                <p className="text-lg font-medium">{run.concept.title}</p>
              </div>
              <div>
                <h4 className="text-sm text-secondary mb-1">Summary</h4>
                <p className="text-sm">{run.concept.summary}</p>
              </div>
              <div>
                <h4 className="text-sm text-secondary mb-1">Subject</h4>
                <p className="text-sm">{run.concept.subject}</p>
              </div>
            </div>
          )}

          {/* Artifacts Display */}
          {run.artifacts.masterProxyClip || run.artifacts.masterClip ? (
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <video
                controls
                autoPlay
                loop
                className={`w-full ${run.profile.orientation === "portrait" ? "aspect-[9/16] max-h-[70vh] object-contain" : "aspect-video"}`}
                src={`/api/runs/${run.id}/asset/${run.artifacts.masterProxyClip ? 'masterProxyClip' : 'masterClip'}`}
              >
                <track kind="captions" />
              </video>
            </div>
          ) : run.artifacts.rawClip ? (
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <video
                controls
                loop
                className={`w-full ${run.profile.orientation === "portrait" ? "aspect-[9/16] max-h-[70vh] object-contain" : "aspect-video"}`}
                src={`/api/runs/${run.id}/asset/rawClip`}
              >
                <track kind="captions" />
              </video>
            </div>
          ) : run.artifacts.image ? (
            <div className="rounded-lg border border-border bg-surface overflow-hidden p-4 flex justify-center">
              <img
                src={`/api/runs/${run.id}/asset/image`}
                alt="Base Render"
                className={`rounded border border-border ${run.profile.orientation === "portrait" ? "max-h-[70vh] object-contain" : "w-full object-contain"}`}
              />
            </div>
          ) : !run.concept ? (
            <div className="rounded-lg border border-border bg-surface p-12 text-center text-secondary flex items-center justify-center h-64">
              No visual artifacts yet.
            </div>
          ) : null}

          {/* Details */}
          {run.shotSpec && (
            <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
              <h3 className="text-lg font-medium text-accent border-b border-border pb-2">
                Shot Spec
              </h3>
              <div>
                <h4 className="text-sm text-secondary mb-1">Image Prompt</h4>
                <p className="text-sm">{run.shotSpec.imagePrompt}</p>
              </div>
              <div>
                <h4 className="text-sm text-secondary mb-1">Motion Prompt</h4>
                <p className="text-sm">{run.shotSpec.motionPrompt}</p>
              </div>
              <div>
                <h4 className="text-sm text-secondary mb-1">Caption Draft</h4>
                {run.status === "gate_b" ? (
                  <textarea
                    className="w-full bg-background border border-border rounded p-2 text-sm focus:border-accent outline-none transition-colors"
                    rows={3}
                    value={editedCaption}
                    onChange={(e) => setEditedCaption(e.target.value)}
                  />
                ) : (
                  <p className="text-sm">{run.shotSpec.captionDraft}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
            <h3 className="text-lg font-medium text-primary">Views</h3>
            <Link
              to={`/runs/${run.id}/compare`}
              className="block w-full text-center rounded bg-surfaceRaised text-accent border border-accent/50 py-2 font-semibold hover:bg-surface transition-colors"
            >
              Compare Stages
            </Link>
          </div>

          <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
            <h3 className="text-lg font-medium text-primary">Actions</h3>
            {isGate ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleAction("advance")}
                  disabled={actionLoading}
                  className="w-full rounded bg-status-ready/20 text-status-ready border border-status-ready/50 py-2 font-semibold hover:bg-status-ready/30 transition-colors disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("reject")}
                  disabled={actionLoading}
                  className="w-full rounded bg-status-danger/20 text-status-danger border border-status-danger/50 py-2 font-semibold hover:bg-status-danger/30 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>

                {run.status === "gate_a" && (
                  <div className="pt-4 mt-4 border-t border-border">
                    <label htmlFor="revise-concept" className="block text-sm text-secondary mb-2">
                      Revise Concept
                    </label>
                    <textarea
                      id="revise-concept"
                      className="w-full bg-background border border-border rounded p-2 text-sm focus:border-accent outline-none transition-colors mb-2"
                      rows={3}
                      placeholder="e.g. Make it more cyberpunk..."
                      value={reviseInstruction}
                      onChange={(e) => setReviseInstruction(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleRevise}
                      disabled={actionLoading || !reviseInstruction.trim()}
                      className="w-full rounded bg-surfaceRaised text-primary border border-border py-2 font-semibold hover:bg-surface transition-colors disabled:opacity-50"
                    >
                      Revise
                    </button>
                  </div>
                )}

                {(run.status === "gate_a5" || run.status === "gate_b") && (
                  <div className="pt-4 mt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={actionLoading}
                      className="w-full rounded bg-surfaceRaised text-primary border border-border py-2 font-semibold hover:bg-surface transition-colors disabled:opacity-50"
                    >
                      Regenerate {run.status === "gate_a5" ? "Image" : "Video"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-secondary">
                {run.status === "ready" || run.status === "rejected" || run.status === "failed"
                  ? "Run has completed."
                  : "Run is processing. Operator action not currently required."}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
            <h3 className="text-lg font-medium text-primary">Metadata</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Orientation</span>
                <span className="capitalize">{run.profile.orientation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Style</span>
                <span>{run.style || "none"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Created At</span>
                <span>{new Date(run.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Per-step cost ledger: which model ran each step and what it cost. */}
          <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
            <h3 className="text-lg font-medium text-primary">Cost</h3>
            <div className="space-y-2 text-sm">
              {costRows.map(({ entry, key }) => (
                <div key={key} className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 capitalize text-secondary">{entry.stage}</span>
                  <span
                    className="flex-1 truncate text-right font-mono text-xs text-faint"
                    title={entry.model ?? entry.provider}
                  >
                    {entry.model ?? entry.provider}
                  </span>
                  <span className="shrink-0 font-mono">${entry.amountUsd.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 mt-2 font-medium">
                <span>Total</span>
                <span className="font-mono">${totalCost.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-faint">
              Amounts are estimates; real provider charges appear on each provider's billing.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
