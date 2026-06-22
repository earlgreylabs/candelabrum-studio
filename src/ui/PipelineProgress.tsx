import { AlertTriangle, Check, Circle, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  currentPipelineStepIndex,
  PIPELINE_STEPS,
  type PipelineStepDefinition,
  type PipelineStepId,
} from "@/core/pipeline-steps";
import type { ProviderCapability } from "@/core/provider-selection";
import type { Run } from "@/core/run";
import type { ProviderOption } from "@/providers/catalog";

interface PipelineProgressProps {
  run: Run;
  providerOptions: ProviderOption[];
  providerDefaults: Partial<Record<ProviderCapability, string>>;
}

const STEP_CAPABILITY: Partial<Record<PipelineStepId, ProviderCapability>> = {
  direct: "concept",
  "gate-a": "finalise",
  image: "image",
  "gate-a5": "video",
  animate: "video",
  "gate-b": "caption",
  caption: "caption",
};

function StepIcon({ state }: { state: "complete" | "current" | "upcoming" | "error" }) {
  if (state === "complete") return <Check aria-hidden="true" size={14} />;
  if (state === "error") return <AlertTriangle aria-hidden="true" size={14} />;
  return <Circle aria-hidden="true" size={state === "current" ? 12 : 9} />;
}

function explanationId(step: PipelineStepDefinition): string {
  return `pipeline-step-${step.id}`;
}

export function PipelineProgress({
  run,
  providerOptions,
  providerDefaults,
}: PipelineProgressProps) {
  const [selectedId, setSelectedId] = useState<PipelineStepId | null>(null);
  const currentIndex = currentPipelineStepIndex(run);
  const selected = PIPELINE_STEPS.find((step) => step.id === selectedId);
  const selectedCapability = selected ? STEP_CAPABILITY[selected.id] : undefined;
  const selectedProviderId = selectedCapability
    ? (run.providerSelections[selectedCapability] ?? providerDefaults[selectedCapability])
    : undefined;
  const selectedProvider = providerOptions.find(
    (option) => option.capability === selectedCapability && option.id === selectedProviderId,
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <section
      aria-label="Pipeline progress"
      className="mb-8 rounded-lg border border-border bg-surface p-4"
    >
      <div className="overflow-x-auto pb-2">
        <ol className="flex min-w-max items-start">
          {PIPELINE_STEPS.map((step, index) => {
            const isError = index === currentIndex && Boolean(run.lastError);
            const state = isError
              ? "error"
              : index < currentIndex
                ? "complete"
                : index === currentIndex
                  ? "current"
                  : "upcoming";
            const expanded = selectedId === step.id;
            return (
              <li key={step.id} className="flex items-start">
                <button
                  type="button"
                  aria-current={state === "current" || state === "error" ? "step" : undefined}
                  aria-expanded={expanded}
                  aria-controls={expanded ? explanationId(step) : undefined}
                  onClick={() => setSelectedId(expanded ? null : step.id)}
                  className={`group flex w-24 flex-col items-center gap-2 rounded px-1 py-2 text-center focus:outline-none focus:ring-2 focus:ring-accent ${
                    state === "complete"
                      ? "text-status-ready"
                      : state === "current"
                        ? "text-accent"
                        : state === "error"
                          ? "text-status-danger"
                          : "text-faint hover:text-secondary"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current">
                    <StepIcon state={state} />
                  </span>
                  <span className="text-xs font-medium">{step.label}</span>
                </button>
                {index < PIPELINE_STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`mt-5 h-px w-5 ${index < currentIndex ? "bg-status-ready" : "bg-border"}`}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {selected ? (
        <section
          id={explanationId(selected)}
          className="mt-3 rounded border border-border bg-surfaceRaised p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                {selected.kind === "gate" ? "Operator gate" : "Pipeline stage"}
              </p>
              <h2 className="mt-1 text-base font-semibold text-primary">{selected.label}</h2>
            </div>
            <button
              type="button"
              aria-label="Close step explanation"
              onClick={() => setSelectedId(null)}
              className="rounded p-1 text-secondary hover:bg-surface hover:text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <p className="mt-3 text-sm text-secondary">{selected.description}</p>
          {selectedProvider ? (
            <p className="mt-3 text-sm text-primary">
              Provider: <span className="font-medium text-accent">{selectedProvider.label}</span>{" "}
              <span className="font-mono text-xs text-faint">{selectedProvider.model}</span>
            </p>
          ) : null}
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-xs text-faint">Input</dt>
              <dd className="mt-1 text-primary">{selected.input}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Output</dt>
              <dd className="mt-1 text-primary">{selected.output}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Cost behavior</dt>
              <dd className="mt-1 text-primary">{selected.cost}</dd>
            </div>
          </dl>
          {run.lastError && currentIndex === PIPELINE_STEPS.indexOf(selected) ? (
            <p className="mt-3 rounded border border-status-danger/50 bg-status-danger/10 p-2 text-sm text-status-danger">
              Current issue: {run.lastError.message}
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
