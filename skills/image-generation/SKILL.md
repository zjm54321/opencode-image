---
name: image-generation
description: "Generate, edit, or transform images. Use when the task requires creating visual assets, illustrations, diagrams, textures, icons, mockups, or editing existing images."
---

# Image Generation Master Skill

This skill is the central router and orchestrator for image generation and visual editing in OpenCode. It evaluates task requirements, inspects available models in the current runtime, and routes execution to the appropriate image engine and its bundled subskill.

---

## 1. Universal Model Capabilities Matrix

This matrix documents the full spectrum of supported models across both the OpenAI (Codex upstream) and Google Gemini (Nano Banana upstream) ecosystems. This is a reference map of capabilities; actual model availability in the current environment is determined dynamically at runtime by `opencode.json`.

| Provider / Family | Model ID | Primary Strengths | Key Constraints & Considerations |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `gpt-image-2.5-flare` | Fast everyday flagship, natural lighting, high texture fidelity, native `transparent` background support | Fine-grained localized micro-edits are better handled by Sunburst |
| | `gpt-image-2.5-sunburst` | Precision inpainting, high style adherence, complex multi-element editing (`edits`) | Higher latency; optimal for final deliverables and intricate edits |
| | `gpt-image-2` | Baseline 2.0 realism, strong spatial layout | Custom sizes must strictly be multiples of 16px; no native transparent background output |
| | `gpt-image-1.5` | Legacy transparent background generation, crisp graphic/vector styling | Lower detail fidelity compared to 2.5 series |
| **Google Gemini** | `gemini-3.1-flash-image` | High throughput, excellent textual rendering (posters, signs, typography), native aspect ratio scaling | No native transparent Alpha channel (outputs solid background JPEG/PNG) |
| | `gemini-3-pro-image` | Complex multi-image fusion, deep multimodal prompt alignment, character consistency | Higher compute requirements; reserved for advanced multi-reference composition |
| | `gemini-3.1-flash-lite-image` | Ultra-fast previews (~4s), rapid compositional iteration | Reduced resolution and fine-grain details |

---

## 2. Dynamic Model Discovery & Decision Workflow

The agent MUST follow this runtime workflow before initiating image generation:

```
[User Task Request]
        │
        ▼
[Analyze Capability Requirements]
 (Transparency, aspect ratio, text rendering, inpainting, speed)
        │
        ▼
[Inspect Runtime Enabled Models] ──► (Read `opencode.json` or query tool configuration)
        │
   ┌────┴─────────────────────────────┐
   ▼                                  ▼
[Target Model is Available]     [Target Model Not Configured]
   │                                  │
   │                                  ▼
   │                            [Apply Fallback Ladder]
   │                            (Select closest available model)
   │                                  │
   └───────────────┬──────────────────┘
                   ▼
       [Route to Engine & Subskill]
       - OpenAI Engine (image_gen)       ──► read subskills/openai/SKILL.md
       - Gemini Engine (image_gen_nano) ──► read subskills/nanobanana/SKILL.md
```

### Decision Routing Rules

1. **Transparent Background / Cutout / Icon / Sticker:**
   - Preferred Route: **OpenAI** (`image_gen`) with `transparent_background: true`.
   - Optimal Model: `gpt-image-2.5-flare` (or `gpt-image-2.5-sunburst` / `gpt-image-1.5`).
   - Do NOT route transparent requests to Gemini (it does not output native Alpha channels).

2. **In-Image Typography, Signboards, Book Covers, Complex Lettering:**
   - Preferred Route: **Gemini / Nano Banana** (`image_gen_nano`).
   - Optimal Model: `gemini-3.1-flash-image` (or `gemini-3-pro-image` if available).

3. **Specific Aspect Ratios (16:9, 9:16, 4:5, 5:4, 21:9):**
   - Both engines support aspect ratios.
   - For Gemini: pass `aspect_ratio` directly to `image_gen_nano`.
   - For OpenAI: `image_gen` automatically maps aspect ratios to valid pixel boundaries (multiples of 16).

4. **Multi-Image Character / Persona Consistency:**
   - Preferred Route: **Gemini / Nano Banana** (`image_gen_nano`) with `referenced_image_paths` and `session_id`.

5. **Precise Inpainting & Masked Replacement:**
   - Preferred Route: **OpenAI** (`image_gen`) with `referenced_image_paths`.

---

## 3. Subskill Delegation

Once the routing decision and target model are determined:

1. **OpenAI Route:**
   - Consult `subskills/openai/SKILL.md` for prompt structuring, lighting, composition, and style presets.
   - Call the native tool `image_gen` with `prompt` and optional parameters (`model`, `transparent_background`, `referenced_image_paths`).

2. **Gemini / Nano Banana Route:**
   - Consult `subskills/nanobanana/SKILL.md` for multimodal reference alignment, camera angle directives, and character prompt rules.
   - Call the native tool `image_gen_nano` with `prompt`, `aspect_ratio`, and optional parameters (`model`, `referenced_image_paths`, `session_id`).

Images generated by both tools are automatically persisted to the project workspace under `.opencode/generated-images/` and returned as lightweight Markdown links.
