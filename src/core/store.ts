/**
 * On-disk run state. Each run is a directory under `runs/`; `metadata.json` is
 * both the resume state and the learning record. Persisted after every stage
 * transition. Parsed through the Run schema so disk is a validated boundary.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { type Run, runSchema } from "@/core/run";

export class RunStore {
  constructor(private readonly runsDir: string) {}

  private dir(id: string): string {
    return resolve(this.runsDir, id);
  }

  private metaPath(id: string): string {
    return resolve(this.dir(id), "metadata.json");
  }

  async save(run: Run): Promise<void> {
    const dir = this.dir(run.id);
    const destination = this.metaPath(run.id);
    const temporary = resolve(dir, `metadata.${crypto.randomUUID()}.tmp`);
    await mkdir(dir, { recursive: true });

    try {
      await Bun.write(temporary, JSON.stringify(run, null, 2));
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async exists(id: string): Promise<boolean> {
    return Bun.file(this.metaPath(id)).exists();
  }

  async load(id: string): Promise<Run> {
    const file = Bun.file(this.metaPath(id));
    if (!(await file.exists())) {
      throw new Error(`run not found: ${id}`);
    }
    return runSchema.parse(await file.json());
  }

  async list(): Promise<Run[]> {
    if (!existsSync(this.runsDir)) {
      return [];
    }
    const entries = await readdir(this.runsDir, { withFileTypes: true });
    const runs: Run[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const file = Bun.file(resolve(this.runsDir, entry.name, "metadata.json"));
      if (await file.exists()) {
        runs.push(runSchema.parse(await file.json()));
      }
    }
    return runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}
