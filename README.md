# opencode-image

> Native OpenCode V2 plugin providing dual image generation engines (`image_gen` for OpenAI Codex and `image_gen_nano` for Google Gemini / Nano Banana) with a bundled universal skill router and zero-token-bloat artifact management.

[![npm version](https://img.shields.io/npm/v/opencode-image.svg)](https://www.npmjs.com/package/opencode-image)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why `opencode-image`? (Design Philosophy)

Integrating image generation into AI coding assistants often suffers from three major flaws:

1. **Leaky Monolithic Abstractions**: Trying to force OpenAI and Google Gemini into a single unified function signature breaks what makes each engine special. OpenAI excels at native Alpha-channel transparency (`background: "transparent"`) and pixel-level bounding constraints; Google Gemini (Nano Banana) excels at visual aspect ratios (`16:9`, `9:16`, `21:9`), rich in-image typography, and multi-turn multimodal image editing. Blending them into one tool confuses model prompting and leads to invalid parameter errors.
2. **Context Window Exhaustion (Token Bloat)**: Returning raw base64 image strings (~1MB to 3MB) directly into the agent conversation consumes tens of thousands of tokens per image, dilutes LLM reasoning attention, and triggers premature context compaction.
3. **Rigid Model Hardcoding**: Tools that hardcode specific model names break when providers release new versions (such as `gpt-image-2.5-flare` or `gemini-3.1-flash-image`), or break for users whose environment only has access to a subset of models.

`opencode-image` solves these problems with a clean, decoupled architecture:

- **Dual Orthogonal Tools**: Dedicated `image_gen` (1:1 Codex native replica) and `image_gen_nano` (dedicated Gemini multimodal engine).
- **Zero-Token-Bloat Artifact Isolation**: All generated image bytes are persisted directly to workspace disk under `.opencode/generated-images/`. The LLM receives only a lightweight relative path and a clean Markdown preview link (`![prompt](.opencode/generated-images/...)`).
- **Dynamic Model Discovery & Presets**: Configured declaratively in `opencode.json`. The plugin includes built-in capability presets (16-pixel multiples, aspect ratio mapping, transparency flags) while discovering what models are actually enabled at runtime.
- **Parent-Child Skill Router**: Bundles `skills/image-generation/` containing a model-agnostic Master Router alongside verbatim upstream subskills (`subskills/openai/` and `subskills/nanobanana/`), continuously synchronizable via GitHub Actions.

---

## Architecture Overview

```
[User Request] ──► [Master Router Skill (skills/image-generation/)]
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
[OpenAI Route: image_gen]       [Gemini Route: image_gen_nano]
  • gpt-image-2.5-flare           • gemini-3.1-flash-image
  • gpt-image-2.5-sunburst        • gemini-3-pro-image
  • Native Alpha Transparency     • Aspect ratios (16:9, 9:16, 21:9)
  • Inpainting & Edits            • Character continuity & Multi-ref
         │                               │
         └───────────────┬───────────────┘
                         ▼
        [Artifact Manager (Disk Persistence)]
        ==> Saves to .opencode/generated-images/
        ==> Returns Markdown preview & path handle
```

---

## Installation

Add `opencode-image` to the `plugins` array in your `opencode.json`:

```json
{
  "plugins": [
    "opencode-image@0.1.0"
  ]
}
```

---

## Configuration

`opencode-image` supports OpenCode's native `{env:VAR_NAME}` template resolution and dual-tier inheritance.

### Option 1: Zero-Config Inheritance (Recommended)
If your `opencode.json` already defines `openai` and `google` under `provider` or `providers`, `opencode-image` will **automatically inherit** their `apiKey` and `baseURL`:

```json
{
  "provider": {
    "google": {
      "options": {
        "apiKey": "{env:GEMINI_API_KEY}",
        "baseURL": "{env:GEMINI_BASE_URL}"
      }
    }
  },
  "providers": {
    "openai": {
      "settings": {
        "apiKey": "{env:OPENAI_API_KEY}",
        "baseURL": "{env:OPENAI_BASE_URL}"
      }
    }
  }
}
```

### Option 2: Explicit Custom Configuration
You can explicitly configure `image_generation` in `opencode.json` (or in a writable `~/.config/opencode/imagegen.json`):

```json
{
  "image_generation": {
    "openai": {
      "apiKey": "{env:OPENAI_API_KEY}",
      "baseURL": "https://api.openai.com/v1",
      "default_model": "gpt-image-2.5-flare",
      "available_models": [
        "gpt-image-2.5-flare",
        "gpt-image-2.5-sunburst"
      ]
    },
    "nanobanana": {
      "apiKey": "{env:GEMINI_API_KEY}",
      "baseURL": "https://generativelanguage.googleapis.com/v1beta",
      "default_model": "gemini-3.1-flash-image",
      "available_models": [
        "gemini-3.1-flash-image"
      ]
    }
  }
}
```

---

## Tool Reference

### 1. `image_gen` (OpenAI Engine)

1:1 replica of OpenAI Codex native `image_gen`.

```typescript
image_gen({
  prompt: string;                       // Required: image description
  model?: string;                        // Optional: e.g. "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"
  transparent_background?: boolean;      // Optional: true for PNG alpha cutout
  referenced_image_paths?: string[];     // Optional: paths to local images for editing
  num_last_images_to_include?: number;   // Optional: reference recent conversation images (1-5)
  aspect_ratio?: string;                 // Optional: e.g. "1:1", "16:9", "9:16"
  quality?: string;                      // Optional: "low", "medium", "high", "xhigh", "max"
})
```

### 2. `image_gen_nano` (Gemini / Nano Banana Engine)

Dedicated engine for Google Gemini multimodal image generation.

```typescript
image_gen_nano({
  prompt: string;                        // Required: image description or edit prompt
  model?: string;                        // Optional: e.g. "gemini-3.1-flash-image"
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9" | "2:3" | "3:2" | "4:5" | "5:4";
  referenced_image_paths?: string[];     // Optional: reference images for multi-modal context
  session_id?: string;                   // Optional: character/world consistency ID
  resolution?: "0.5K" | "1K" | "2K" | "4K"; // Optional: resolution tier (default "1K")
})
```

---

## Built-in Model Capability Presets

The plugin includes built-in metadata presets for leading models:

| Provider | Model ID | Strengths | Transparency | Aspect Ratios |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `gpt-image-2.5-flare` | High speed, natural light, crisp textures | Yes (`transparent`) | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `21:9`, `auto` |
| | `gpt-image-2.5-sunburst` | Complex multi-element editing, extreme detail | Yes (`transparent`) | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `21:9`, `auto` |
| | `gpt-image-2` | Baseline 2.0 realism | No (Chroma-key) | Multiples of 16px, max 3:1 ratio |
| | `gpt-image-1.5` | Legacy transparent stickers/icons | Yes (`transparent`) | `1024x1024`, `1536x1024`, `1024x1536` |
| **Google** | `gemini-3.1-flash-image` | Sharp typography, signboard lettering, fast | Solid | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `21:9`, etc. |
| | `gemini-3-pro-image` | High-complexity multi-image composition | Solid | Full aspect ratio spectrum |
| | `gemini-3.1-flash-lite-image` | Rapid draft exploration (~4s) | Solid | Standard aspect ratios |

---

## Bundled Skill & Upstream Synchronization

The plugin bundles `skills/image-generation/` containing:
- `SKILL.md`: Master decision router with capability matrix and fallback ladders.
- `subskills/openai/`: Full upstream Codex image generation skill, scripts, and references.
- `subskills/nanobanana/`: Full upstream Nano Banana skill, scripts, and model specifications.

A GitHub Actions workflow (`.github/workflows/sync-skills.yml`) runs on schedule to sync upstream prompt assets, validate integrity, and maintain provenance.

---

## License

MIT License (c) 2026 zjm54321
