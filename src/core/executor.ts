import { advance } from "@/core/orchestrator";
import type { PipelineContext } from "@/core/pipeline";
import { type Run, recordRunFailure } from "@/core/run";

/** Result of asking the executor to run a pipeline. */
export interface StartExecutionResult {
  started: boolean;
  task: Promise<void>;
}

/**
 * Owns in-process pipeline execution. A run id may have only one active task, so
 * repeated HTTP requests cannot submit the same paid stage twice.
 */
export class RunExecutor {
  private readonly active = new Map<string, Promise<void>>();
  private readonly mutationQueues = new Map<string, Promise<void>>();

  start(run: Run, ctx: PipelineContext): StartExecutionResult {
    const activeTask = this.active.get(run.id);
    if (activeTask) {
      return { started: false, task: activeTask };
    }

    const task = this.execute(run, ctx);
    this.active.set(run.id, task);
    const removeActiveTask = () => {
      if (this.active.get(run.id) === task) {
        this.active.delete(run.id);
      }
    };
    void task.then(removeActiveTask, removeActiveTask);

    return { started: true, task };
  }

  isActive(runId: string): boolean {
    return this.active.has(runId);
  }

  /** Serialize operator mutations such as approve and revise for one run id. */
  async mutate<T>(runId: string, mutation: () => Promise<T>): Promise<T> {
    const previous = this.mutationQueues.get(runId) ?? Promise.resolve();
    let release = () => {};
    const slot = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => slot);
    this.mutationQueues.set(runId, queued);

    await previous;
    try {
      return await mutation();
    } finally {
      release();
      if (this.mutationQueues.get(runId) === queued) {
        this.mutationQueues.delete(runId);
      }
    }
  }

  private async execute(run: Run, ctx: PipelineContext): Promise<void> {
    try {
      await advance(run, ctx);
    } catch (error) {
      const failure = recordRunFailure(run, error);
      ctx.log(`[Run ${run.id}] paused at ${failure.status}: ${failure.message}`);
      ctx.notify("Run Paused", `Run ${run.id} needs attention at ${failure.status}`);
      try {
        await ctx.store.save(run);
      } catch (saveError) {
        ctx.log(
          `[Run ${run.id}] could not persist failure: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
        );
      }
    }
  }
}
