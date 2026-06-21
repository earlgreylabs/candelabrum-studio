# Model & Provider Research

As Candelabrum Studio expands, the landscape of AI models and API providers (runners) grows increasingly complex. This document serves as a living ledger to track, compare, and balance different models and runners based on their specialization, cost, speed, and quality.

## Providers & Runners

### 1. Fal.ai

- **Specialization**: High-speed, low-latency inference for diffusion models (image and video).
- **Integration**: Strong official TypeScript SDK (`@fal-ai/client`) that gracefully handles WebSockets, progress streaming, and retries. Rarely need to touch raw REST.
- **Pros**: Excellent for real-time or near-real-time generation. Huge catalog of models (Stable Diffusion, Flux, upscalers like Magnific/AuraSR).
- **Cons**: Pricing can accumulate quickly on heavy video models.

### 2. WaveSpeed

- **Specialization**: General-purpose AI inference platform.
- **Integration**: SDK ecosystem is still maturing. We frequently have to switch to raw `fetch` REST calls and manually handle polling/webhooks for long-running video generations.
- **Pros**: Good selection of models and highly competitive pricing. Strong alternative to traditional serverless GPU providers.
- **Cons**: Newer platform, API stability and latency need real-world benchmarking against established players.

### 3. Hugging Face (Inference Endpoints)

- **Specialization**: Custom model hosting and open-source models.
- **Integration**: Official `@huggingface/inference` SDK is decent for standard tasks, but for highly customized models or bespoke endpoints, raw REST is often the more reliable fallback.
- **Pros**: Access to the absolute bleeding edge of open-source models. Can deploy dedicated endpoints for absolute privacy and predictable performance.
- **Cons**: Dedicated endpoints are billed by the hour, which is expensive for bursty/sporadic usage compared to pay-per-token serverless.

### 4. Ollama (Local)

- **Specialization**: Local execution of LLMs and basic vision models.
- **Integration**: Has an official `ollama` npm package, but it also natively exposes an OpenAI-compatible REST API, making it trivial to drop into existing tools (like Vercel AI SDK) without vendor lock-in.
- **Pros**: 100% free, complete privacy, no network latency. Great for the Director LLM stage or local captioning.
- **Cons**: Bound by the host machine's hardware (Apple Silicon unified memory). Cannot realistically run heavy video diffusion models or massive 70B+ LLMs at high speeds without a high-end Mac Studio/Pro.

---

## Model Specializations

### Image Generation (Gate A.5)

- **Midjourney / Niji**: Best-in-class aesthetic and prompt adherence, but lacks an official, stable developer API (requires unofficial wrappers).
- **Flux (via Fal.ai / WaveSpeed)**: The current open-weight king for typography and photorealism. Extremely fast.
- **Stable Diffusion 3 / XL**: Highly tunable, great ecosystem for LoRAs and ControlNets.

### Video Animation (Gate B)

- **Google Veo (via Vertex / AI Studio)**: Exceptional cinematic consistency and prompt adherence.
- **Luma Dream Machine**: Great dynamic motion, accessible API.
- **Runway Gen-3**: Industry standard for high-fidelity video generation.
- **Kling AI**: Emerging leader for long-form, complex motion.

### Upscaling & Enhancement

- **Topaz Photo AI (Local)**: Excellent local application for extreme crispness.
- **Magnific AI (via Fal.ai)**: Market leader for adding hallucinated micro-details ("crispness") to AI images.
- **Aura SR (via Fal.ai)**: Fast, open-source alternative for super-resolution.

### Frame Interpolation

- **RIFE (Local / ncnn-vulkan)**: Fast, local, hardware-accelerated interpolation (e.g., 24fps -> 120fps) to achieve slow-motion fluidity without API costs.

---

## Decision Matrix / Balancing Strategy

When selecting a provider for a stage, evaluate against these criteria:

1. **Cost vs. Quality**: Does the stage require the absolute best model (e.g., the final video render), or is it a hidden intermediate step (e.g., director LLM reasoning) where a cheaper/local model suffices?
2. **Latency vs. Throughput**: For interactive dashboard elements, latency is king (Fal.ai). For background pipeline processing, throughput and cost matter more (WaveSpeed / Local).
3. **Privacy**: If the lore or concepts contain sensitive/unreleased IP, local execution (Ollama) or zero-retention enterprise APIs are mandatory.
