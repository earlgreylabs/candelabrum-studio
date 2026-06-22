import { createApp } from "@/server/app";
import { productionDependencies, resumeInterruptedRuns } from "@/server/runtime";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
const app = createApp(productionDependencies);

if (import.meta.main) {
  console.log(`[Server] Starting on http://127.0.0.1:${port}`);
  void resumeInterruptedRuns(productionDependencies)
    .then((count) => {
      if (count > 0) console.log(`[Server] resumed ${count} interrupted run(s)`);
    })
    .catch((error) => console.error("[Server] failed to resume interrupted runs:", error));
}

export default {
  port,
  hostname: "127.0.0.1",
  fetch: app.fetch,
};
