import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface ImageEngineConfig {
  enabled?: boolean;
  apiKey?: string;
  baseURL?: string;
  default_model?: string;
  available_models?: string[];
}

export interface ImageGenerationPluginConfig {
  openai: ImageEngineConfig;
  nanobanana: ImageEngineConfig;
}

const DEFAULT_CONFIG: ImageGenerationPluginConfig = {
  openai: {
    enabled: true,
    default_model: "gpt-image-2.5-flare",
    available_models: [
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
      "image-2.5",
      "gpt-image-2",
      "gpt-image-1.5",
    ],
    baseURL: "https://api.openai.com/v1",
  },
  nanobanana: {
    enabled: true,
    default_model: "gemini-3.1-flash-image",
    available_models: [
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "gemini-3.1-flash-lite-image",
    ],
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
  },
};

let activeConfig: ImageGenerationPluginConfig = {
  openai: { ...DEFAULT_CONFIG.openai },
  nanobanana: { ...DEFAULT_CONFIG.nanobanana },
};

function readJsonFile(filePath: string): any {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

/**
 * Resolves OpenCode "{env:VAR_NAME}" template placeholders or returns literal string.
 */
export function resolveTemplate(val?: string): string | undefined {
  if (!val || typeof val !== "string") return undefined;
  const match = val.match(/^{env:([^}]+)}$/);
  if (match) {
    return process.env[match[1]] || undefined;
  }
  return val;
}

export function loadConfiguration(hostOpencodeConfig?: Record<string, unknown>): ImageGenerationPluginConfig {
  const home = os.homedir();
  const dedicatedConfigPath = path.join(home, ".config", "opencode", "imagegen.json");
  const dedicatedConfig = readJsonFile(dedicatedConfigPath);

  const opencodeConfigPath = path.join(home, ".config", "opencode", "opencode.json");
  const fileOpencodeConfig = readJsonFile(opencodeConfigPath);

  const rootConfig = (hostOpencodeConfig || fileOpencodeConfig || {}) as any;

  const result: ImageGenerationPluginConfig = {
    openai: { ...DEFAULT_CONFIG.openai },
    nanobanana: { ...DEFAULT_CONFIG.nanobanana },
  };

  // 1. Inherit from standard OpenCode provider blocks if available in opencode.json
  const standardOpenAi = rootConfig.providers?.openai?.settings
    || rootConfig.provider?.openai?.options
    || rootConfig.provider?.openai?.settings;

  const standardGoogle = rootConfig.provider?.google?.options
    || rootConfig.providers?.google?.settings;

  if (standardOpenAi) {
    result.openai.apiKey = resolveTemplate(standardOpenAi.apiKey);
    result.openai.baseURL = resolveTemplate(standardOpenAi.baseURL) || result.openai.baseURL;
  }

  if (standardGoogle) {
    result.nanobanana.apiKey = resolveTemplate(standardGoogle.apiKey);
    result.nanobanana.baseURL = resolveTemplate(standardGoogle.baseURL) || result.nanobanana.baseURL;
  }

  // 2. Read explicit "image_generation" block from opencode.json or imagegen.json
  const customBlock = (rootConfig.image_generation as any)
    ?? (dedicatedConfig?.image_generation as any)
    ?? dedicatedConfig;

  if (customBlock?.openai) {
    result.openai = {
      ...result.openai,
      ...customBlock.openai,
      apiKey: resolveTemplate(customBlock.openai.apiKey || customBlock.openai.api_key) || result.openai.apiKey,
      baseURL: resolveTemplate(customBlock.openai.baseURL || customBlock.openai.base_url) || result.openai.baseURL,
    };
  }

  if (customBlock?.nanobanana) {
    result.nanobanana = {
      ...result.nanobanana,
      ...customBlock.nanobanana,
      apiKey: resolveTemplate(customBlock.nanobanana.apiKey || customBlock.nanobanana.api_key) || result.nanobanana.apiKey,
      baseURL: resolveTemplate(customBlock.nanobanana.baseURL || customBlock.nanobanana.base_url) || result.nanobanana.baseURL,
    };
  }

  // 3. Fallback to standard environment variables if still undefined
  result.openai.apiKey = result.openai.apiKey || process.env.OPENAI_API_KEY;
  result.nanobanana.apiKey = result.nanobanana.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  activeConfig = result;
  return result;
}

export function getConfig(): ImageGenerationPluginConfig {
  return activeConfig;
}
