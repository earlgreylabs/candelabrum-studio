# Lessons Learned

Key discoveries made while wiring Candelabrum Studio end to end. The point is to
not relearn the same thing twice. Newest at the top of each section.

## Provider / AI SDK integration

- **Veo image-to-video is not usable through `@ai-sdk/google`'s video model (v3.0.83).**
  `experimental_generateVideo({ prompt: { image } })` serialises the base image as
  `image.inlineData` (the `generateContent` chat shape). The Gemini API's Veo
  `:predictLongRunning` endpoint rejects it: *"`inlineData` isn't supported by this
  model."* It fails for **every** Veo model (3.0-fast, 3.0, 3.1-preview), so it is
  an SDK shape bug, not a model issue. Fix: call `:predictLongRunning` directly with
  the image as `image.bytesBase64Encoded` + `mimeType`, then poll the operation.
- **Veo `-fast` variants are text-to-video only.** They reject any image input
  outright. Image-to-video needs a standard / 3.1 model.
- **List the models a key actually has** before guessing ids:
  `GET https://generativelanguage.googleapis.com/v1beta/models?key=…`. The Gemini
  API names Veo 3.1 `veo-3.1-generate-preview` (a `-preview` suffix), not `-001`.
- **Gemini image generation ≠ fal/Imagen image generation in the AI SDK.** Gemini
  (`gemini-3.1-flash-image`, "Nano Banana") returns the image as a *file part* on a
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
