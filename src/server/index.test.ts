import { beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { loadSettings } from "@/core/config";
import { createRun, type Run, transition } from "@/core/run";
import { RunStore } from "@/core/store";
import app from "./index";

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
    const data = (await res.json()) as { run: Run };
    expect(data.run).toBeDefined();
    expect(data.run.id).toBe(run.id);
    expect(data.run.status).toBe("rejected");
  });

  // Regression: `/api/runs/events` must resolve to the SSE stream, not be matched
  // as `/api/runs/:id` with id "events" (which 404s and leaves the dashboard
  // permanently "disconnected"). The events route has to be registered first.
  test("GET /api/runs/events streams SSE, not matched as :id", async () => {
    const controller = new AbortController();
    const res = await app.fetch(
      new Request("http://localhost/api/runs/events", { signal: controller.signal }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    if (!res.body) {
      throw new Error("events response had no body");
    }
    const reader = res.body.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain("runs-update");

    // The handler is an infinite loop; release it so the test can exit.
    await reader.cancel();
    controller.abort();
  });
});
