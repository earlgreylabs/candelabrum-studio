import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ProviderCapability, ProviderSelections } from "@/core/provider-selection";
import type { Run, RunStatus } from "@/core/run";
import { PipelineProgress } from "./PipelineProgress";
import { ProviderSelect } from "./ProviderSelect";
import { useProviderCatalog } from "./provider-catalog";

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
  const [providerChoices, setProviderChoices] = useState<ProviderSelections>({});
  const catalog = useProviderCatalog();

  const providerFor = (capability: ProviderCapability): string =>
    providerChoices[capability] ??
    run?.providerSelections[capability] ??
    catalog?.defaults[capability] ??
    "";
  const chooseProvider = (capability: ProviderCapability, provider: string) => {
    setProviderChoices((current) => ({ ...current, [capability]: provider }));
  };

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
      !run.lastError &&
      !GATE_STATUSES.includes(run.status) &&
      !TERMINAL_STATUSES.includes(run.status);
    if (!processing) return;
    const interval = setInterval(fetchRun, 2500);
    return () => clearInterval(interval);
  }, [run, fetchRun]);

  const handleAction = async (action: "advance" | "reject") => {
    if (!run) return;
    setActionLoading(true);
    try {
      const input: Record<string, string> = {};
      if (action === "advance" && run.status === "gate_a") {
        input.finaliseProvider = providerFor("finalise");
        input.imageProvider = providerFor("image");
      } else if (action === "advance" && run.status === "gate_a5") {
        input.videoProvider = providerFor("video");
      } else if (action === "advance" && run.status === "gate_b") {
        input.caption = editedCaption;
        input.captionProvider = providerFor("caption");
      }
      const body = action === "advance" ? JSON.stringify(input) : undefined;

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
        body: JSON.stringify({
          instruction: reviseInstruction,
          provider: providerFor("revision"),
        }),
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
      const capability = run.status === "gate_a5" ? "image" : "video";
      const res = await fetch(`/api/runs/${run.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerFor(capability) }),
      });
      if (!res.ok) {
        throw new Error(await errorMessage(res, "Regenerate failed"));
      }
      navigate("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const capabilityByStatus: Partial<Record<RunStatus, ProviderCapability>> = {
        directing: "concept",
        imaging: "image",
        animating: "video",
        captioning: "caption",
      };
      const capability = capabilityByStatus[run.status];
      const res = await fetch(`/api/runs/${run.id}/resume`, {
        method: "POST",
        headers: capability ? { "Content-Type": "application/json" } : undefined,
        body: capability ? JSON.stringify({ provider: providerFor(capability) }) : undefined,
      });
      if (!res.ok) {
        throw new Error(await errorMessage(res, "Resume failed"));
      }
      fetchRun();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/recover`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await errorMessage(res, "Recover failed"));
      }
      fetchRun();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-primary">Loading...</div>;
  if (error || !run) return <div className="p-8 text-status-danger">{error || "Not found"}</div>;

  const isGate = ["gate_a", "gate_a5", "gate_b"].includes(run.status);
  const drop = MANUAL_DROP[run.status];
  const totalCost = run.cost.reduce((sum, c) => sum + c.amountUsd, 0);
  const retryCapability: ProviderCapability | undefined =
    run.status === "directing"
      ? "concept"
      : run.status === "imaging"
        ? "image"
        : run.status === "animating"
          ? "video"
          : run.status === "captioning"
            ? "caption"
            : undefined;
  const approvalLabel =
    run.status === "gate_a"
      ? "Approve & Generate Base Image"
      : run.status === "gate_a5"
        ? "Approve & Animate"
        : "Approve & Export Package";
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
            run.lastError
              ? "text-status-danger"
              : isGate
                ? "text-status-warning"
                : ["ready"].includes(run.status)
                  ? "text-status-ready"
                  : "text-status-rendering"
          }`}
        >
          {run.status.replace("_", " ")}
        </div>
      </header>

      <PipelineProgress
        run={run}
        providerOptions={catalog?.options ?? []}
        providerDefaults={catalog?.defaults ?? {}}
      />

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
          {run.artifacts.masterMode === "pass-through" && (
            <div className="rounded-lg border border-status-warning/50 bg-status-warning/10 p-4">
              <h3 className="font-medium text-status-warning">Enhancement bypassed</h3>
              <p className="mt-1 text-sm text-secondary">
                {run.artifacts.masterNote ?? "The raw clip is being used as the master."}
              </p>
            </div>
          )}

          {run.artifacts.masterProxyClip || run.artifacts.masterClip ? (
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <video
                controls
                autoPlay
                loop
                className={`w-full ${run.profile.orientation === "portrait" ? "aspect-[9/16] max-h-[70vh] object-contain" : "aspect-video"}`}
                src={`/api/runs/${run.id}/asset/${run.artifacts.masterProxyClip ? "masterProxyClip" : "masterClip"}`}
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
                {run.status === "gate_a" ? (
                  <div className="space-y-3 rounded border border-border bg-background p-3">
                    <ProviderSelect
                      capability="finalise"
                      label="Prompt finalization provider"
                      options={catalog?.options ?? []}
                      value={providerFor("finalise")}
                      disabled={actionLoading}
                      onChange={(provider) => chooseProvider("finalise", provider)}
                    />
                    <ProviderSelect
                      capability="image"
                      label="Base image provider"
                      options={catalog?.options ?? []}
                      value={providerFor("image")}
                      disabled={actionLoading}
                      onChange={(provider) => chooseProvider("image", provider)}
                    />
                  </div>
                ) : run.status === "gate_a5" ? (
                  <ProviderSelect
                    capability="video"
                    label="Animation provider"
                    options={catalog?.options ?? []}
                    value={providerFor("video")}
                    disabled={actionLoading}
                    onChange={(provider) => chooseProvider("video", provider)}
                  />
                ) : (
                  <ProviderSelect
                    capability="caption"
                    label="Caption provider"
                    options={catalog?.options ?? []}
                    value={providerFor("caption")}
                    disabled={actionLoading}
                    onChange={(provider) => chooseProvider("caption", provider)}
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleAction("advance")}
                  disabled={actionLoading}
                  className="w-full rounded bg-status-ready/20 text-status-ready border border-status-ready/50 py-2 font-semibold hover:bg-status-ready/30 transition-colors disabled:opacity-50"
                >
                  {approvalLabel}
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
                    <ProviderSelect
                      capability="revision"
                      label="Revision provider"
                      options={catalog?.options ?? []}
                      value={providerFor("revision")}
                      disabled={actionLoading}
                      onChange={(provider) => chooseProvider("revision", provider)}
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
                    <ProviderSelect
                      capability={run.status === "gate_a5" ? "image" : "video"}
                      label={
                        run.status === "gate_a5"
                          ? "Re-roll image provider"
                          : "Re-run video provider"
                      }
                      options={catalog?.options ?? []}
                      value={providerFor(run.status === "gate_a5" ? "image" : "video")}
                      disabled={actionLoading}
                      onChange={(provider) =>
                        chooseProvider(run.status === "gate_a5" ? "image" : "video", provider)
                      }
                    />
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
              <div className="space-y-4">
                {run.lastError && (
                  <div className="rounded border border-status-danger/50 bg-status-danger/10 p-3">
                    <p className="text-sm font-medium text-status-danger">
                      Paused at {run.lastError.status.replace("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-secondary">{run.lastError.message}</p>
                    <p className="mt-1 text-xs text-faint">Attempt {run.lastError.attempt}</p>
                    {run.lastError.retryable && (
                      <div className="mt-3 space-y-3">
                        {retryCapability ? (
                          <ProviderSelect
                            capability={retryCapability}
                            label="Retry provider"
                            options={catalog?.options ?? []}
                            value={providerFor(retryCapability)}
                            disabled={actionLoading}
                            onChange={(provider) => chooseProvider(retryCapability, provider)}
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={handleResume}
                          disabled={actionLoading}
                          className="w-full rounded border border-status-warning/50 bg-status-warning/20 py-2 font-semibold text-status-warning hover:bg-status-warning/30 disabled:opacity-50"
                        >
                          {retryCapability ? "Authorize Retry" : "Retry Current Stage"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-sm text-secondary">
                  {run.status === "ready" || run.status === "rejected" || run.status === "failed"
                    ? "Run has completed."
                    : "Run is processing. Operator action not currently required."}
                </p>
                {run.status === "failed" && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-status-danger mb-3">
                      This run failed due to an error. If you have resolved the underlying issue
                      (e.g., added credits or fixed a network issue), you can attempt to recover the
                      run.
                    </p>
                    <button
                      type="button"
                      onClick={handleRecover}
                      disabled={actionLoading}
                      className="w-full rounded bg-status-danger/20 text-status-danger border border-status-danger/50 py-2 font-semibold hover:bg-status-danger/30 transition-colors disabled:opacity-50"
                    >
                      Recover from Failure
                    </button>
                  </div>
                )}
              </div>
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

          {/* Per-step breakdown: which model ran each step, what it cost, and payload. */}
          <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
            <h3 className="text-lg font-medium text-primary">Breakdown</h3>
            <div className="space-y-2 text-sm">
              {costRows.map(({ entry, key }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="shrink-0 capitalize text-secondary">{entry.stage}</span>
                  <span
                    className="flex-1 truncate text-right font-mono text-xs text-faint"
                    title={entry.model ?? entry.provider}
                  >
                    {entry.model ?? entry.provider}
                  </span>
                  {entry.payload && (
                    <button
                      type="button"
                      onClick={() => alert(JSON.stringify(entry.payload, null, 2))}
                      className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/20 border border-accent/30 transition-colors"
                      title="View Payload"
                    >
                      P
                    </button>
                  )}
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
