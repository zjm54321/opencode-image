import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getConfig } from "./config.js";
import { BUILTIN_MODEL_PRESETS, ASPECT_RATIO_TO_PIXELS } from "./presets.js";

export interface ImageGenArgs {
  prompt: string;
  model?: string;
  transparent_background?: boolean;
  referenced_image_paths?: string[];
  num_last_images_to_include?: number;
  aspect_ratio?: string;
  quality?: string;
}

export async function executeOpenAIImageGen(
  args: ImageGenArgs,
  workspaceDir: string = process.cwd()
): Promise<string> {
  const config = getConfig().openai;

  if (config.enabled === false) {
    return JSON.stringify({
      status: "error",
      error_code: "PROVIDER_DISABLED",
      message: "OpenAI image generation provider is disabled in configuration.",
    });
  }

  const selectedModel = args.model || config.default_model || "gpt-image-2.5-flare";

  // Check if model is allowed
  const isAvailable = config.available_models?.includes(selectedModel) ?? true;
  if (!isAvailable) {
    return JSON.stringify({
      status: "error",
      error_code: "MODEL_NOT_CONFIGURED",
      message: `Model '${selectedModel}' is not enabled in the current environment.`,
      requested_model: selectedModel,
      runtime_available_models: config.available_models,
      recommendation: `Choose one of the runtime_available_models or configure it in opencode.json.`,
    });
  }

  if (!config.apiKey) {
    return JSON.stringify({
      status: "error",
      error_code: "AUTH_MISSING",
      message: "No apiKey configured for OpenAI image generation. Please set it in opencode.json (under image_generation.openai or provider.openai) or export OPENAI_API_KEY.",
    });
  }

  const preset = BUILTIN_MODEL_PRESETS[selectedModel];
  const size = args.aspect_ratio ? (ASPECT_RATIO_TO_PIXELS[args.aspect_ratio] || "1024x1024") : "1024x1024";

  const isEdit = (args.referenced_image_paths && args.referenced_image_paths.length > 0);
  const baseUrl = (config.baseURL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = isEdit ? `${baseUrl}/images/edits` : `${baseUrl}/images/generations`;

  const outputDir = path.join(workspaceDir, ".opencode", "generated-images", "openai");
  await fs.mkdir(outputDir, { recursive: true });

  try {
    let responseData: any;

    if (!isEdit) {
      const payload: Record<string, any> = {
        model: selectedModel,
        prompt: args.prompt,
        size: size === "auto" ? "1024x1024" : size,
        quality: args.quality || "auto",
        response_format: "b64_json",
      };

      if (args.transparent_background && preset?.supportsTransparency) {
        payload.background = "transparent";
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        return JSON.stringify({
          status: "error",
          error_code: `HTTP_${res.status}`,
          message: `OpenAI Image API error: ${errText}`,
        });
      }

      responseData = await res.json();
    } else {
      const formData = new FormData();
      formData.append("model", selectedModel);
      formData.append("prompt", args.prompt);
      formData.append("response_format", "b64_json");

      for (const imagePath of args.referenced_image_paths!) {
        const absPath = path.isAbsolute(imagePath) ? imagePath : path.resolve(workspaceDir, imagePath);
        const fileBytes = await fs.readFile(absPath);
        const blob = new Blob([fileBytes], { type: "image/png" });
        formData.append("image", blob, path.basename(absPath));
        break;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        return JSON.stringify({
          status: "error",
          error_code: `HTTP_${res.status}`,
          message: `OpenAI Image Edit API error: ${errText}`,
        });
      }

      responseData = await res.json();
    }

    const b64 = responseData.data?.[0]?.b64_json;
    if (!b64) {
      return JSON.stringify({
        status: "error",
        error_code: "EMPTY_RESULT",
        message: "No image data returned from OpenAI Image API.",
      });
    }

    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const hash = crypto.randomBytes(3).toString("hex");
    const filename = `img-${timestamp}-${hash}.png`;
    const fullPath = path.join(outputDir, filename);

    const imageBuffer = Buffer.from(b64, "base64");
    await fs.writeFile(fullPath, imageBuffer);

    const relPath = path.relative(workspaceDir, fullPath).replace(/\\/g, "/");

    return `Image generated successfully using model \`${selectedModel}\`.\n\n![${args.prompt}](${relPath})\n\n**Path**: \`${relPath}\``;
  } catch (error: any) {
    return JSON.stringify({
      status: "error",
      error_code: "EXECUTION_EXCEPTION",
      message: error?.message || String(error),
    });
  }
}
