import { AlertTriangle, Check } from "lucide-react";
import { Fragment, useState } from "react";
import {
  currentPipelineStepIndex,
  PIPELINE_STEPS,
  type PipelineStepId,
} from "@/core/pipeline-steps";
import type { ProviderCapability } from "@/core/provider-selection";
import type { Run } from "@/core/run";
import type { ProviderOption } from "@/providers/catalog";
import { cn } from "./lib/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogEyebrow,
  DialogHeader,
  DialogTitle,
} from "./primitives/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./primitives/tooltip";

interface PipelineProgressProps {
  run: Run;
  providerOptions: ProviderOption[];
  providerDefaults: Partial<Record<ProviderCapability, string>>;
}

type StepState = "complete" | "current" | "upcoming" | "error";

const STEP_CAPABILITY: Partial<Record<PipelineStepId, ProviderCapability>> = {
  direct: "concept",
  "gate-a": "finalise",
  image: "image",
  "gate-a5": "video",
  animate: "video",
  "gate-b": "caption",
  caption: "caption",
};

const BADGE_BY_STATE: Record<StepState, string> = {
  complete: "border-status-ready/50 bg-status-ready/10 text-status-ready",
  current: "border-accent bg-accent/10 text-accent ring-4 ring-accent/15",
  error: "border-status-danger bg-status-danger/10 text-status-danger",
  upcoming: "border-border text-faint group-hover:border-secondary/60 group-hover:text-secondary",
};

const LABEL_BY_STATE: Record<StepState, string> = {
  complete: "text-secondary",
  current: "text-primary",
  error: "text-status-danger",
  upcoming: "text-faint group-hover:text-secondary",
};

function StepBadgeContent({ state, index }: { state: StepState; index: number }) {
  if (state === "complete") return <Check aria-hidden="true" size={15} />;
  if (state === "error") return <AlertTriangle aria-hidden="true" size={15} />;
  if (state === "current") return <span className="h-2.5 w-2.5 rounded-full bg-current" />;
  return <span className="text-xs font-medium tabular-nums">{index + 1}</span>;
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
  const selectedShowsError =
    selected != null && Boolean(run.lastError) && PIPELINE_STEPS.indexOf(selected) === currentIndex;

  return (
    <section
      aria-label="Pipeline progress"
      className="mb-8 rounded-lg border border-border bg-surface p-4"
    >
      <TooltipProvider delayDuration={250}>
        <ol className="flex items-start overflow-x-auto pb-1">
          {PIPELINE_STEPS.map((step, index) => {
            const state: StepState =
              index === currentIndex && run.lastError
                ? "error"
                : index < currentIndex
                  ? "complete"
                  : index === currentIndex
                    ? "current"
                    : "upcoming";
            const isGate = step.kind === "gate";

            return (
              <Fragment key={step.id}>
                <li className="flex min-w-[4.5rem] flex-col">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-current={state === "current" || state === "error" ? "step" : undefined}
                        onClick={() => setSelectedId(step.id)}
                        className="group flex flex-col items-center gap-2 rounded px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center border transition-colors",
                            isGate ? "rounded-md" : "rounded-full",
                            BADGE_BY_STATE[state],
                          )}
                        >
                          <StepBadgeContent state={state} index={index} />
                        </span>
                        <span
                          className={cn(
                            "text-xs font-medium transition-colors",
                            LABEL_BY_STATE[state],
                          )}
                        >
                          {step.label}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="font-medium text-primary">
                        {isGate ? "Operator gate" : "Pipeline stage"}
                      </span>
                      <span className="mt-1 block">{step.description}</span>
                    </TooltipContent>
                  </Tooltip>
                </li>
                {index < PIPELINE_STEPS.length - 1 ? (
                  <li aria-hidden="true" className="flex min-w-[1.25rem] flex-1 pt-4">
                    <span
                      className={cn(
                        "h-px w-full",
                        index < currentIndex ? "bg-status-ready/50" : "bg-border",
                      )}
                    />
                  </li>
                ) : null}
              </Fragment>
            );
          })}
        </ol>
      </TooltipProvider>

      <Dialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        {selected ? (
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogEyebrow>
                {selected.kind === "gate" ? "Operator gate" : "Pipeline stage"}
              </DialogEyebrow>
              <DialogTitle>{selected.label}</DialogTitle>
            </DialogHeader>

            <DialogDescription>{selected.description}</DialogDescription>

            {selectedProvider ? (
              <p className="mt-3 text-sm text-primary">
                Provider: <span className="font-medium text-accent">{selectedProvider.label}</span>{" "}
                <span className="font-mono text-xs text-faint">{selectedProvider.model}</span>
              </p>
            ) : null}

            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
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

            {selectedShowsError && run.lastError ? (
              <p className="mt-4 rounded border border-status-danger/50 bg-status-danger/10 p-2 text-sm text-status-danger">
                Current issue: {run.lastError.message}
              </p>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
