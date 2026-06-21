import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Run } from "@/core/run";

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
        const data = await res.json();
        throw new Error(data.error || "Action failed");
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
        const data = await res.json();
        throw new Error(data.error || "Revise failed");
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
        const data = await res.json();
        throw new Error(data.error || "Regenerate failed");
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
          {run.artifacts.masterClip ? (
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <video
                controls
                autoPlay
                loop
                className={`w-full ${run.profile.orientation === "portrait" ? "aspect-[9/16] max-h-[70vh] object-contain" : "aspect-video"}`}
                src={`/assets/renders/master/${run.artifacts.masterClip}`}
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
                src={`/assets/renders/raw/${run.artifacts.rawClip}`}
              >
                <track kind="captions" />
              </video>
            </div>
          ) : run.artifacts.image ? (
            <div className="rounded-lg border border-border bg-surface overflow-hidden p-4 flex justify-center">
              <img
                src={`/assets/renders/images/${run.artifacts.image}`}
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
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-secondary">Total Cost</span>
                <span className="font-mono">
                  ${run.cost.reduce((sum, c) => sum + c.amountUsd, 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
