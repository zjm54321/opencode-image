import { describe, it, expect, beforeEach } from "bun:test";
import { executeOpenAIImageGen } from "../src/openai.js";
import { executeNanoBananaImageGen } from "../src/nanobanana.js";
import { loadConfiguration } from "../src/config.js";

describe("execution and structured error handling", () => {
  beforeEach(() => {
    // Setup a strict environment where only specific models are enabled
    loadConfiguration({
      image_generation: {
        openai: {
          enabled: true,
          default_model: "gpt-image-2.5-flare",
          available_models: ["gpt-image-2.5-flare"],
          apiKey: "sk-mock",
        },
        nanobanana: {
          enabled: true,
          default_model: "gemini-3.1-flash-image",
          available_models: ["gemini-3.1-flash-image"],
          apiKey: "gemini-mock",
        },
      },
    });
  });

  it("returns MODEL_NOT_CONFIGURED and lists runtime_available_models if unconfigured model is requested from OpenAI", async () => {
    const rawResult = await executeOpenAIImageGen({
      prompt: "test prompt",
      model: "non-existent-or-unauthorized-model",
    });

    const parsed = JSON.parse(rawResult);
    expect(parsed.status).toBe("error");
    expect(parsed.error_code).toBe("MODEL_NOT_CONFIGURED");
    expect(parsed.runtime_available_models).toEqual(["gpt-image-2.5-flare"]);
  });

  it("returns MODEL_NOT_CONFIGURED if unconfigured model is requested from Nano Banana", async () => {
    const rawResult = await executeNanoBananaImageGen({
      prompt: "test prompt",
      model: "gemini-3-pro-image", // Pro is not configured in this test
    });

    const parsed = JSON.parse(rawResult);
    expect(parsed.status).toBe("error");
    expect(parsed.error_code).toBe("MODEL_NOT_CONFIGURED");
    expect(parsed.runtime_available_models).toEqual(["gemini-3.1-flash-image"]);
  });
});
