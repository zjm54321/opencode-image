import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadConfiguration } from "./config.js";
import { executeOpenAIImageGen, type ImageGenArgs } from "./openai.js";
import { executeNanoBananaImageGen, type ImageGenNanoArgs } from "./nanobanana.js";

function ensureSkillInstalled() {
  try {
    const home = os.homedir();
    const skillsDir = path.join(home, ".config", "opencode", "skills");
    const targetDir = path.join(skillsDir, "image-generation");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const sourceDir = path.resolve(__dirname, "..", "skills", "image-generation");

    if (fs.existsSync(sourceDir) && !fs.existsSync(targetDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
      try {
        fs.symlinkSync(sourceDir, targetDir, "dir");
      } catch (symlinkErr) {
        fs.cpSync(sourceDir, targetDir, { recursive: true });
      }
    }
  } catch (err) {
    // Non-fatal if filesystem is read-only (e.g. managed by Nix)
  }
}

export const ImageGenPlugin = async (ctx: any) => {
  ensureSkillInstalled();
  loadConfiguration();

  const imageGenTool = {
    description: "Generate or edit images with OpenAI Image models (such as gpt-image-2.5-flare, gpt-image-2.5-sunburst). 1:1 replica of Codex image_gen. Saves image locally and returns markdown link.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed description of the image to generate or edit." },
        model: { type: "string", description: "Optional specific model ID (e.g. 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'). Defaults to configured default." },
        transparent_background: { type: "boolean", description: "Whether the output should have a transparent background (PNG). Defaults to false." },
        referenced_image_paths: { type: "array", items: { type: "string" }, description: "Local image file paths for editing/inpainting." },
        num_last_images_to_include: { type: "integer", description: "Number of recent conversation images to reference (1-5)." },
        aspect_ratio: { type: "string", description: "Aspect ratio (e.g. '1:1', '16:9', '9:16', '4:3', '3:4', '21:9')." },
        quality: { type: "string", description: "Image quality: 'low', 'medium', 'high', 'xhigh', 'max', or 'auto'." },
      },
      required: ["prompt"],
    },
    execute: async (args: ImageGenArgs, execContext?: any) => {
      const cwd = execContext?.workdir || ctx?.directory || process.cwd();
      return await executeOpenAIImageGen(args, cwd);
    },
  };

  const imageGenNanoTool = {
    description: "Generate or edit images with Google Gemini / Nano Banana models (such as gemini-3.1-flash-image). Supports native aspect ratios and multi-image reference. Saves image locally and returns markdown link.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Description of the image to generate or editing instruction." },
        model: { type: "string", description: "Optional model ID (e.g. 'gemini-3.1-flash-image'). Defaults to configured default." },
        aspect_ratio: {
          type: "string",
          enum: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "2:3", "3:2", "4:5", "5:4"],
          description: "Aspect ratio of the generated image. Defaults to '1:1'."
        },
        referenced_image_paths: { type: "array", items: { type: "string" }, description: "Local image file paths for character consistency or image-to-image." },
        session_id: { type: "string", description: "Optional session ID for multi-turn character or world continuity." },
        resolution: { type: "string", enum: ["0.5K", "1K", "2K", "4K"], description: "Resolution level. Defaults to '1K'." },
      },
      required: ["prompt"],
    },
    execute: async (args: ImageGenNanoArgs, execContext?: any) => {
      const cwd = execContext?.workdir || ctx?.directory || process.cwd();
      return await executeNanoBananaImageGen(args, cwd);
    },
  };

  return {
    name: "opencode-imagegen",
    tool: {
      image_gen: imageGenTool,
      image_gen_nano: imageGenNanoTool,
    },
    config: async (opencodeConfig: Record<string, unknown>) => {
      loadConfiguration(opencodeConfig);
    },
  };
};

export default {
  id: "opencode-imagegen",
  server: ImageGenPlugin,
  setup: ImageGenPlugin,
};
