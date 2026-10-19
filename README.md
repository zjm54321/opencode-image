# opencode-imagegen

Native OpenCode plugin providing dual image generation engines (OpenAI Codex `image_gen` & Google Nano Banana `image_gen_nano`) with bundled universal skill router.

## Features

- **Dual Dedicated Tools (No Mixed Abstractions)**:
  - `image_gen`: 1:1 replica of OpenAI Codex native image generation (supporting `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, `gpt-image-2`, `gpt-image-1.5`, etc.).
  - `image_gen_nano`: Dedicated interface for Google Gemini / Nano Banana (supporting `gemini-3.1-flash-image`, `gemini-3-pro-image`, etc. with native `aspect_ratio`).
- **Dynamic Config via `opencode.json`**:
  - `apiKey` and `baseURL` support standard OpenCode `{env:VAR_NAME}` template resolution.
  - Automatically inherits existing `provider.openai` and `provider.google` credentials if not explicitly overridden.
- **Built-in Model Capability Presets**:
  - Full metadata knowledge base for model capabilities (transparency support, 16px multiples, aspect ratio mapping).
- **Bundled Master Router Skill**:
  - Bundles `skills/image-generation/` containing the master decision router and complete upstream subskills (`subskills/openai/` and `subskills/nanobanana/`).
- **Zero Token Bloat**:
  - All images are persisted locally to `.opencode/generated-images/` and returned as minimal Markdown references.

## Configuration in `opencode.json`

Add the plugin and configure `image_generation` (optional if standard providers are already configured):

```json
{
  "plugins": [
    "file:///home/ming/opencode-imagegen"
  ],
  "image_generation": {
    "openai": {
      "apiKey": "{env:EEHUB_API_KEY}",
      "baseURL": "{env:EEHUB_API_URL}",
      "default_model": "gpt-image-2.5-flare",
      "available_models": [
        "gpt-image-2.5-flare",
        "gpt-image-2.5-sunburst"
      ]
    },
    "nanobanana": {
      "apiKey": "{env:EEHUB_API_KEY}",
      "baseURL": "{env:EEHUB_API_URL}",
      "default_model": "gemini-3.1-flash-image",
      "available_models": [
        "gemini-3.1-flash-image"
      ]
    }
  }
}
```

Or configure via a dedicated writable file `~/.config/opencode/imagegen.json` (recommended for NixOS users).

## Nix Flake / Home-Manager Integration

To manage the bundled skill declaratively in `nix-config/module/ai/skill/home-manager.nix`:

```nix
let
  imageGenSkill = pkgs.runCommand "image-generation" {} ''
    mkdir -p $out
    cp -r /home/ming/opencode-imagegen/skills/image-generation/* $out/
  '';
in
{
  programs.agent-skills = {
    sources = {
      image-generation = source imageGenSkill ".";
    };
    skills.enable = [
      "image-generation"
    ];
  };
}
```
