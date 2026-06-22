# Lessons Learned

Key discoveries made while wiring Candelabrum Studio end to end. The point is to
not relearn the same thing twice. Newest at the top of each section.

## Provider / AI SDK integration

- **Veo image-to-video is not usable through `@ai-sdk/google`'s video model (v3.0.83).**
  `experimental_generateVideo({ prompt: { image } })` serialises the base image as
  `image.inlineData` (the `generateContent` chat shape). The Gemini API's Veo
  `:predictLongRunning` endpoint rejects it: _"`inlineData` isn't supported by this
  model."_ It fails for **every** Veo model (3.0-fast, 3.0, 3.1-preview), so it is
  an SDK shape bug, not a model issue. Fix: call `:predictLongRunning` directly with
  the image as `image.bytesBase64Encoded` + `mimeType`, then poll the operation.
- **Veo `-fast` variants are text-to-video only.** They reject any image input
  outright. Image-to-video needs a standard / 3.1 model.
- **List the models a key actually has** before guessing ids:
  `GET https://generativelanguage.googleapis.com/v1beta/models?key=…`. The Gemini
  API names Veo 3.1 `veo-3.1-generate-preview` (a `-preview` suffix), not `-001`.
- **Gemini image generation ≠ fal/Imagen image generation in the AI SDK.** Gemini
  (`gemini-3.1-flash-image`, "Nano Banana") returns the image as a _file part_ on a
  `generateText` response (read `result.files`). fal/Imagen use `generateImage`
  (`result.image`). Different call, different result shape.
- **`@ai-sdk/google` reads `GOOGLE_GENERATIVE_AI_API_KEY`, not `GEMINI_API_KEY`.**
  We standardised on `GEMINI_API_KEY` (the AI Studio name) and pass it explicitly
  via `createGoogleGenerativeAI({ apiKey })`.
- **Aspect ratio for Gemini images** goes through `providerOptions.google.imageConfig.aspectRatio`.
- **Model id for cost tracking**: AI SDK model args are `string | ModelObject`; the
  object exposes `.modelId`. `modelIdOf()` normalises both. `ai` declares but does
  not export its `VideoModel` type — derive it from the call signature.
- **Verify AI SDK APIs against installed `node_modules`, never memory.** The bundled
  `node_modules/ai/docs` and provider `docs/` are the source of truth; versions drift.

## Dashboard / server (Hono + Vite)

- **Deduplicate both execution and mutation.** Guarding background `advance()` calls
  prevents duplicate stages, but Gate A finalisation and concept revision happen
  before background execution. Serialize operator mutations per run id as well, or
  concurrent requests can still duplicate paid LLM work.
- **A retryable failure is not a terminal pipeline position.** Keep `status` at the
  stage that failed and persist a separate structured `lastError`. The dashboard can
  explain the pause and retry the same status; `failed` is reserved for legacy or
  genuinely unrecoverable runs.
- **Register specific routes before parameterised ones.** `/api/runs/events` was
  shadowed by `/api/runs/:id` (matched `events` as an id → 404). Hono matches in
  registration order.
- **The Vite dev proxy only forwards `/api`, not `/assets`.** Asset URLs under
  `/assets/*` were silently answered by Vite's SPA `index.html` fallback (HTTP 200,
  `text/html`). Serve media under `/api/...` so the proxy forwards it. Lesson:
  **check `Content-Type`, not just the status code** — a 200 can be the wrong body.
- **Artifacts store absolute paths in different roots** (base image in `runs/`,
  video in `renders/`). Serve them by resolving the path the run recorded
  (`/api/runs/:id/asset/:kind`), not by reconstructing a URL layout.
- **Don't run a blocking/manual stage inside an HTTP request.** A `ManualInbox`
  stage polls forever; doing it in the request hangs until the proxy times out
  (empty-body 504 → cryptic `JSON.parse` crash on the client). The gate POST should
  transition + return, then advance in the background, with progress over SSE.
- **Dark-theme FOUC**: set `background-color` + `color-scheme: dark` inline on
  `<html>` so the first paint (before Tailwind's JS-injected CSS) isn't white.

## Process / testing

- **Test orchestration with stage substitutions, not fake media files passed to real
  binaries.** Once interpolation stopped swallowing errors, text pretending to be an
  MP4 correctly failed on machines with ffmpeg installed. `PipelineContext.stages`
  keeps orchestration tests deterministic while focused stage tests own media logic.
- **Persist run JSON atomically.** Write metadata to a unique temporary file in the
  run directory, then rename it over `metadata.json`. A crash must leave either the
  previous valid checkpoint or the new one, never partial JSON.
- **Stage retries must be idempotent.** Before paying a provider or repeating heavy
  local work, reuse an existing persisted artifact. Regeneration remains explicit
  because it clears the relevant artifact first.
- **Missing tools and broken tools are different states.** Missing optional local
  binaries may produce a clearly labelled pass-through master. If installed tools
  fail or produce incomplete output, surface a resumable stage error instead of
  silently shipping the raw clip as a successful master.
- **Write export metadata after the run becomes `ready`.** If final metadata writing
  fails, roll the transition back to `exporting`; otherwise the run is terminal but
  its package is incomplete and cannot be retried.
- **Tests must not write to the live data dir.** The reject test created runs in
  the real `runs/` and "cleaned" a different (nonexistent) path, so every run
  polluted the dashboard. Track created ids and remove exactly those; never bulk-rm
  the runs dir (it holds real runs).
- **`--hot` does not re-read `.env`.** A running dev server keeps its startup env; a
  fresh CLI process (`bun run cli …`) picks up new keys. Restart the server to use a
  new key from the dashboard path.
- **Background poll loops are not resumable.** A manual-stage loop lives only in the
  server process; a `--hot` reload or restart kills it while the on-disk status stays
  mid-stage. Open gap: resume in-flight runs on server boot.

## Cost / models

- **Per-step ledger**: each `cost` entry records `{ stage, provider, model, amountUsd }`
  so the breakdown (from-text → refine-text → text-to-image → image-to-video) is
  traceable. Amounts are estimates; the AI SDK returns token `usage` but real dollars
  need a per-model pricing table (not yet built).
- **Veo is the expensive step** — dollars per clip even on fast; the real figure
  shows on Google AI Studio billing, not in the API response.
