// src/index.ts
import fs4 from "node:fs";
import path4 from "node:path";
import os2 from "node:os";
import { fileURLToPath } from "node:url";

// src/config.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
var DEFAULT_CONFIG = {
  openai: {
    enabled: true,
    default_model: "gpt-image-2.5-flare",
    available_models: [
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
      "image-2.5",
      "gpt-image-2",
      "gpt-image-1.5"
    ],
    baseURL: "https://api.openai.com/v1"
  },
  nanobanana: {
    enabled: true,
    default_model: "gemini-3.1-flash-image",
    available_models: [
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "gemini-3.1-flash-lite-image"
    ],
    baseURL: "https://generativelanguage.googleapis.com/v1beta"
  }
};
var activeConfig = {
  openai: { ...DEFAULT_CONFIG.openai },
  nanobanana: { ...DEFAULT_CONFIG.nanobanana }
};
function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  return null;
}
function resolveTemplate(val) {
  if (!val || typeof val !== "string")
    return;
  const match = val.match(/^{env:([^}]+)}$/);
  if (match) {
    return process.env[match[1]] || undefined;
  }
  return val;
}
function loadConfiguration(hostOpencodeConfig) {
  const home = os.homedir();
  const dedicatedConfigPath = path.join(home, ".config", "opencode", "imagegen.json");
  const dedicatedConfig = readJsonFile(dedicatedConfigPath);
  const opencodeConfigPath = path.join(home, ".config", "opencode", "opencode.json");
  const fileOpencodeConfig = readJsonFile(opencodeConfigPath);
  const rootConfig = hostOpencodeConfig || fileOpencodeConfig || {};
  const result = {
    openai: { ...DEFAULT_CONFIG.openai },
    nanobanana: { ...DEFAULT_CONFIG.nanobanana }
  };
  const standardOpenAi = rootConfig.providers?.openai?.settings || rootConfig.provider?.openai?.options || rootConfig.provider?.openai?.settings;
  const standardGoogle = rootConfig.provider?.google?.options || rootConfig.providers?.google?.settings;
  if (standardOpenAi) {
    result.openai.apiKey = resolveTemplate(standardOpenAi.apiKey);
    result.openai.baseURL = resolveTemplate(standardOpenAi.baseURL) || result.openai.baseURL;
  }
  if (standardGoogle) {
    result.nanobanana.apiKey = resolveTemplate(standardGoogle.apiKey);
    result.nanobanana.baseURL = resolveTemplate(standardGoogle.baseURL) || result.nanobanana.baseURL;
  }
  const customBlock = rootConfig.image_generation ?? dedicatedConfig?.image_generation ?? dedicatedConfig;
  if (customBlock?.openai) {
    result.openai = {
      ...result.openai,
      ...customBlock.openai,
      apiKey: resolveTemplate(customBlock.openai.apiKey || customBlock.openai.api_key) || result.openai.apiKey,
      baseURL: resolveTemplate(customBlock.openai.baseURL || customBlock.openai.base_url) || result.openai.baseURL
    };
  }
  if (customBlock?.nanobanana) {
    result.nanobanana = {
      ...result.nanobanana,
      ...customBlock.nanobanana,
      apiKey: resolveTemplate(customBlock.nanobanana.apiKey || customBlock.nanobanana.api_key) || result.nanobanana.apiKey,
      baseURL: resolveTemplate(customBlock.nanobanana.baseURL || customBlock.nanobanana.base_url) || result.nanobanana.baseURL
    };
  }
  result.openai.apiKey = result.openai.apiKey || process.env.OPENAI_API_KEY;
  result.nanobanana.apiKey = result.nanobanana.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  activeConfig = result;
  return result;
}
function getConfig() {
  return activeConfig;
}

// src/openai.ts
import fs2 from "node:fs/promises";
import path2 from "node:path";
import crypto from "node:crypto";

// src/presets.ts
var BUILTIN_MODEL_PRESETS = {
  "gpt-image-2.5-flare": {
    id: "gpt-image-2.5-flare",
    provider: "openai",
    displayName: "OpenAI GPT Image 2.5 Flare",
    supportsTransparency: true,
    allowedAspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9", "auto"],
    maxEditImages: 10,
    qualityOptions: ["low", "medium", "high", "xhigh", "max", "auto"],
    requires16Multiple: true
  },
  "gpt-image-2.5-sunburst": {
    id: "gpt-image-2.5-sunburst",
    provider: "openai",
    displayName: "OpenAI GPT Image 2.5 Sunburst",
    supportsTransparency: true,
    allowedAspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9", "auto"],
    maxEditImages: 10,
    qualityOptions: ["low", "medium", "high", "xhigh", "max", "auto"],
    requires16Multiple: true
  },
  "image-2.5": {
    id: "gpt-image-2.5-flare",
    provider: "openai",
    displayName: "OpenAI Image 2.5 (Alias -> Flare)",
    supportsTransparency: true,
    allowedAspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9", "auto"],
    maxEditImages: 10,
    qualityOptions: ["low", "medium", "high", "xhigh", "max", "auto"],
    requires16Multiple: true
  },
  "gpt-image-2": {
    id: "gpt-image-2",
    provider: "openai",
    displayName: "OpenAI GPT Image 2",
    supportsTransparency: false,
    allowedAspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "auto"],
    maxEditImages: 5,
    qualityOptions: ["low", "medium", "high", "auto"],
    requires16Multiple: true
  },
  "gpt-image-1.5": {
    id: "gpt-image-1.5",
    provider: "openai",
    displayName: "OpenAI GPT Image 1.5",
    supportsTransparency: true,
    allowedAspectRatios: ["1:1", "16:9", "9:16", "auto"],
    maxEditImages: 5,
    qualityOptions: ["low", "medium", "high", "auto"],
    requires16Multiple: false
  },
  "gpt-image-1-mini": {
    id: "gpt-image-1-mini",
    provider: "openai",
    displayName: "OpenAI GPT Image 1 Mini",
    supportsTransparency: true,
    allowedAspectRatios: ["1:1", "16:9", "9:16", "auto"],
    maxEditImages: 5,
    qualityOptions: ["low", "medium", "high", "auto"],
    requires16Multiple: false
  },
  "gemini-3.1-flash-image": {
    id: "gemini-3.1-flash-image",
    provider: "nanobanana",
    displayName: "Nano Banana 2 (Gemini 3.1 Flash Image)",
    supportsTransparency: false,
    allowedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    maxEditImages: 4,
    qualityOptions: ["0.5K", "1K", "2K", "4K"]
  },
  "gemini-3-pro-image": {
    id: "gemini-3-pro-image",
    provider: "nanobanana",
    displayName: "Nano Banana Pro (Gemini 3 Pro Image)",
    supportsTransparency: false,
    allowedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    maxEditImages: 5,
    qualityOptions: ["1K", "2K", "4K"]
  },
  "gemini-3.1-flash-lite-image": {
    id: "gemini-3.1-flash-lite-image",
    provider: "nanobanana",
    displayName: "Nano Banana 2 Lite (Gemini 3.1 Flash Lite)",
    supportsTransparency: false,
    allowedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
    maxEditImages: 2,
    qualityOptions: ["0.5K", "1K"]
  }
};
var ASPECT_RATIO_TO_PIXELS = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:3": "1280x960",
  "3:4": "960x1280",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
  "21:9": "1536x656",
  "4:5": "1024x1280",
  "5:4": "1280x1024",
  auto: "auto"
};

// src/openai.ts
async function executeOpenAIImageGen(args, workspaceDir = process.cwd()) {
  const config = getConfig().openai;
  if (config.enabled === false) {
    return JSON.stringify({
      status: "error",
      error_code: "PROVIDER_DISABLED",
      message: "OpenAI image generation provider is disabled in configuration."
    });
  }
  const selectedModel = args.model || config.default_model || "gpt-image-2.5-flare";
  const isAvailable = config.available_models?.includes(selectedModel) ?? true;
  if (!isAvailable) {
    return JSON.stringify({
      status: "error",
      error_code: "MODEL_NOT_CONFIGURED",
      message: `Model '${selectedModel}' is not enabled in the current environment.`,
      requested_model: selectedModel,
      runtime_available_models: config.available_models,
      recommendation: `Choose one of the runtime_available_models or configure it in opencode.json.`
    });
  }
  if (!config.apiKey) {
    return JSON.stringify({
      status: "error",
      error_code: "AUTH_MISSING",
      message: "No apiKey configured for OpenAI image generation. Please set it in opencode.json (under image_generation.openai or provider.openai) or export OPENAI_API_KEY."
    });
  }
  const preset = BUILTIN_MODEL_PRESETS[selectedModel];
  const size = args.aspect_ratio ? ASPECT_RATIO_TO_PIXELS[args.aspect_ratio] || "1024x1024" : "1024x1024";
  const isEdit = args.referenced_image_paths && args.referenced_image_paths.length > 0;
  const baseUrl = (config.baseURL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = isEdit ? `${baseUrl}/images/edits` : `${baseUrl}/images/generations`;
  const outputDir = path2.join(workspaceDir, ".opencode", "generated-images", "openai");
  await fs2.mkdir(outputDir, { recursive: true });
  try {
    let responseData;
    if (!isEdit) {
      const payload = {
        model: selectedModel,
        prompt: args.prompt,
        size: size === "auto" ? "1024x1024" : size,
        quality: args.quality || "auto",
        response_format: "b64_json"
      };
      if (args.transparent_background && preset?.supportsTransparency) {
        payload.background = "transparent";
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        return JSON.stringify({
          status: "error",
          error_code: `HTTP_${res.status}`,
          message: `OpenAI Image API error: ${errText}`
        });
      }
      responseData = await res.json();
    } else {
      const formData = new FormData;
      formData.append("model", selectedModel);
      formData.append("prompt", args.prompt);
      formData.append("response_format", "b64_json");
      for (const imagePath of args.referenced_image_paths) {
        const absPath = path2.isAbsolute(imagePath) ? imagePath : path2.resolve(workspaceDir, imagePath);
        const fileBytes = await fs2.readFile(absPath);
        const blob = new Blob([fileBytes], { type: "image/png" });
        formData.append("image", blob, path2.basename(absPath));
        break;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        },
        body: formData
      });
      if (!res.ok) {
        const errText = await res.text();
        return JSON.stringify({
          status: "error",
          error_code: `HTTP_${res.status}`,
          message: `OpenAI Image Edit API error: ${errText}`
        });
      }
      responseData = await res.json();
    }
    const b64 = responseData.data?.[0]?.b64_json;
    if (!b64) {
      return JSON.stringify({
        status: "error",
        error_code: "EMPTY_RESULT",
        message: "No image data returned from OpenAI Image API."
      });
    }
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const hash = crypto.randomBytes(3).toString("hex");
    const filename = `img-${timestamp}-${hash}.png`;
    const fullPath = path2.join(outputDir, filename);
    const imageBuffer = Buffer.from(b64, "base64");
    await fs2.writeFile(fullPath, imageBuffer);
    const relPath = path2.relative(workspaceDir, fullPath).replace(/\\/g, "/");
    return `Image generated successfully using model \`${selectedModel}\`.

![${args.prompt}](${relPath})

**Path**: \`${relPath}\``;
  } catch (error) {
    return JSON.stringify({
      status: "error",
      error_code: "EXECUTION_EXCEPTION",
      message: error?.message || String(error)
    });
  }
}

// src/nanobanana.ts
import fs3 from "node:fs/promises";
import path3 from "node:path";
import crypto2 from "node:crypto";
async function executeNanoBananaImageGen(args, workspaceDir = process.cwd()) {
  const config = getConfig().nanobanana;
  if (config.enabled === false) {
    return JSON.stringify({
      status: "error",
      error_code: "PROVIDER_DISABLED",
      message: "Nano Banana (Gemini) image generation provider is disabled in configuration."
    });
  }
  const selectedModel = args.model || config.default_model || "gemini-3.1-flash-image";
  const isAvailable = config.available_models?.includes(selectedModel) ?? true;
  if (!isAvailable) {
    return JSON.stringify({
      status: "error",
      error_code: "MODEL_NOT_CONFIGURED",
      message: `Model '${selectedModel}' is not enabled in the current environment.`,
      requested_model: selectedModel,
      runtime_available_models: config.available_models,
      recommendation: `Choose one of the runtime_available_models or configure it in opencode.json.`
    });
  }
  if (!config.apiKey) {
    return JSON.stringify({
      status: "error",
      error_code: "AUTH_MISSING",
      message: "No apiKey configured for Gemini / Nano Banana image generation. Please set it in opencode.json or imagegen.json."
    });
  }
  const outputDir = path3.join(workspaceDir, ".opencode", "generated-images", "nano");
  await fs3.mkdir(outputDir, { recursive: true });
  const aspectRatio = args.aspect_ratio || "1:1";
  const baseUrl = (config.baseURL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const isOpenAiCompatible = !baseUrl.includes("googleapis.com") || baseUrl.endsWith("/v1");
  try {
    let b64;
    if (isOpenAiCompatible) {
      const endpoint = `${baseUrl}/images/generations`;
      const size = ASPECT_RATIO_TO_PIXELS[aspectRatio] || "1024x1024";
      const payload = {
        model: selectedModel,
        prompt: args.prompt,
        size: size === "auto" ? "1024x1024" : size,
        response_format: "b64_json",
        n: 1
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        return JSON.stringify({
          status: "error",
          error_code: `HTTP_${res.status}`,
          message: `Nano Banana Gateway error: ${errText}`
        });
      }
      const responseData = await res.json();
      b64 = responseData.data?.[0]?.b64_json;
      if (!b64 && responseData.data?.[0]?.url) {
        const imgRes = await fetch(responseData.data[0].url);
        const arrayBuf = await imgRes.arrayBuffer();
        b64 = Buffer.from(arrayBuf).toString("base64");
      }
    } else {
      const url = baseUrl.includes("key=") ? `${baseUrl}/models/${selectedModel}:predict` : `${baseUrl}/models/${selectedModel}:predict?key=${config.apiKey}`;
      const payload = {
        instances: [{ prompt: args.prompt }],
        parameters: {
          aspectRatio,
          outputOptions: { mimeType: "image/png" },
          sampleCount: 1
        }
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        return JSON.stringify({
          status: "error",
          error_code: `HTTP_${res.status}`,
          message: `Gemini Nano Banana API error: ${errText}`
        });
      }
      const responseData = await res.json();
      b64 = responseData.predictions?.[0]?.bytesBase64Encoded || responseData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    }
    if (!b64) {
      return JSON.stringify({
        status: "error",
        error_code: "EMPTY_RESULT",
        message: "No image data returned from Nano Banana API."
      });
    }
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const hash = crypto2.randomBytes(3).toString("hex");
    const filename = `img-${timestamp}-${hash}.png`;
    const fullPath = path3.join(outputDir, filename);
    const imageBuffer = Buffer.from(b64, "base64");
    await fs3.writeFile(fullPath, imageBuffer);
    const relPath = path3.relative(workspaceDir, fullPath).replace(/\\/g, "/");
    return `Image generated successfully using model \`${selectedModel}\` (${aspectRatio}).

![${args.prompt}](${relPath})

**Path**: \`${relPath}\``;
  } catch (error) {
    return JSON.stringify({
      status: "error",
      error_code: "EXECUTION_EXCEPTION",
      message: error?.message || String(error)
    });
  }
}

// src/index.ts
function ensureSkillInstalled() {
  try {
    const home = os2.homedir();
    const skillsDir = path4.join(home, ".config", "opencode", "skills");
    const targetDir = path4.join(skillsDir, "image-generation");
    const __dirname2 = path4.dirname(fileURLToPath(import.meta.url));
    const sourceDir = path4.resolve(__dirname2, "..", "skills", "image-generation");
    if (fs4.existsSync(sourceDir) && !fs4.existsSync(targetDir)) {
      fs4.mkdirSync(skillsDir, { recursive: true });
      try {
        fs4.symlinkSync(sourceDir, targetDir, "dir");
      } catch (symlinkErr) {
        fs4.cpSync(sourceDir, targetDir, { recursive: true });
      }
    }
  } catch (err) {}
}
var ImageGenPlugin = async (ctx) => {
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
        quality: { type: "string", description: "Image quality: 'low', 'medium', 'high', 'xhigh', 'max', or 'auto'." }
      },
      required: ["prompt"]
    },
    execute: async (args, execContext) => {
      const cwd = execContext?.workdir || ctx?.directory || process.cwd();
      return await executeOpenAIImageGen(args, cwd);
    }
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
        resolution: { type: "string", enum: ["0.5K", "1K", "2K", "4K"], description: "Resolution level. Defaults to '1K'." }
      },
      required: ["prompt"]
    },
    execute: async (args, execContext) => {
      const cwd = execContext?.workdir || ctx?.directory || process.cwd();
      return await executeNanoBananaImageGen(args, cwd);
    }
  };
  return {
    name: "opencode-imagegen",
    tool: {
      image_gen: imageGenTool,
      image_gen_nano: imageGenNanoTool
    },
    config: async (opencodeConfig) => {
      loadConfiguration(opencodeConfig);
    }
  };
};
var src_default = {
  id: "opencode-imagegen",
  server: ImageGenPlugin,
  setup: ImageGenPlugin
};
export {
  ImageGenPlugin,
  src_default as default
};
