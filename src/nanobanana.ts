import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getConfig } from "./config.js";

export interface ImageGenNanoArgs {
  prompt: string;
  model?: string;
  aspect_ratio?: string;
  referenced_image_paths?: string[];
  session_id?: string;
  resolution?: string;
}

export async function executeNanoBananaImageGen(
  args: ImageGenNanoArgs,
  workspaceDir: string = process.cwd()
): Promise<string> {
  const config = getConfig().nanobanana;

  if (config.enabled === false) {
    return JSON.stringify({
      status: "error",
      error_code: "PROVIDER_DISABLED",
      message: "Nano Banana (Gemini) image generation provider is disabled in configuration.",
    });
  }

  const selectedModel = args.model || config.default_model || "gemini-3.1-flash-image";

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
      message: "No apiKey configured for Gemini / Nano Banana image generation. Please set it in opencode.json (under image_generation.nanobanana or provider.google) or export GEMINI_API_KEY.",
    });
  }

  const outputDir = path.join(workspaceDir, ".opencode", "generated-images", "nano");
  await fs.mkdir(outputDir, { recursive: true });

  const aspectRatio = args.aspect_ratio || "1:1";
  const baseUrl = (config.baseURL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");

  // Prepare input images if any
  const inlineImages: Array<{ mimeType: string; data: string }> = [];
  if (args.referenced_image_paths && args.referenced_image_paths.length > 0) {
    for (const imgPath of args.referenced_image_paths) {
      try {
        const absPath = path.isAbsolute(imgPath) ? imgPath : path.resolve(workspaceDir, imgPath);
        const bytes = await fs.readFile(absPath);
        const b64 = bytes.toString("base64");
        const ext = path.extname(absPath).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        inlineImages.push({ mimeType, data: b64 });
      } catch {
        // ignore missing ref
      }
    }
  }

  try {
    // Google Gemini Image Generation endpoint
    // POST {baseURL}/models/{model}:predict?key={apiKey} or Authorization header
    const url = baseUrl.includes("key=")
      ? `${baseUrl}/models/${selectedModel}:predict`
      : `${baseUrl}/models/${selectedModel}:predict?key=${config.apiKey}`;

    const payload = {
      instances: [
        {
          prompt: args.prompt,
        }
      ],
      parameters: {
        aspectRatio: aspectRatio,
        outputOptions: {
          mimeType: "image/png"
        },
        sampleCount: 1,
      }
    };

    const res = await fetch(url, {
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
        message: `Gemini Nano Banana API error: ${errText}`,
      });
    }

    const responseData: any = await res.json();
    const b64 = responseData.predictions?.[0]?.bytesBase64Encoded
      || responseData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!b64) {
      return JSON.stringify({
        status: "error",
        error_code: "EMPTY_RESULT",
        message: "No image data returned from Gemini Nano Banana API.",
      });
    }

    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const hash = crypto.randomBytes(3).toString("hex");
    const filename = `img-${timestamp}-${hash}.png`;
    const fullPath = path.join(outputDir, filename);

    const imageBuffer = Buffer.from(b64, "base64");
    await fs.writeFile(fullPath, imageBuffer);

    const relPath = path.relative(workspaceDir, fullPath).replace(/\\/g, "/");

    return `Image generated successfully using model \`${selectedModel}\` (${aspectRatio}).\n\n![${args.prompt}](${relPath})\n\n**Path**: \`${relPath}\``;
  } catch (error: any) {
    return JSON.stringify({
      status: "error",
      error_code: "EXECUTION_EXCEPTION",
      message: error?.message || String(error),
    });
  }
}
