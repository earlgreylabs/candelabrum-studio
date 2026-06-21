import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import app from "./index";
import { createRun, transition } from "@/core/run";
import { RunStore } from "@/core/store";
import { loadSettings } from "@/core/config";

const TEST_RUNS_DIR = resolve(process.cwd(), "config", "runs");

describe("API Endpoints", () => {
  beforeAll(async () => {
    try {
      await rm(TEST_RUNS_DIR, { recursive: true, force: true });
    } catch {}
  });

  test("GET /api/health", async () => {
    const res = await app.fetch(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("POST /api/runs/:id/reject", async () => {
    const settings = await loadSettings(resolve(process.cwd(), "config"));
    const store = new RunStore(settings.paths.runs);
    
    // Create a mock run and persist it in gate_a
    const run = createRun(settings, { orientation: "portrait" });
    transition(run, "gate_a", "test");
    await store.save(run);

    // Call the reject endpoint
    const req = new Request(`http://localhost/api/runs/${run.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "rejected concept via API" }),
    });
    const res = await app.fetch(req);
    
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.run).toBeDefined();
    expect(data.run.id).toBe(run.id);
    expect(data.run.status).toBe("rejected");
  });
});
