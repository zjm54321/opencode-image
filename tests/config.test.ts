import { describe, it, expect, beforeEach } from "bun:test";
import { resolveTemplate, loadConfiguration } from "../src/config.js";

describe("configuration and template resolution", () => {
  beforeEach(() => {
    process.env.TEST_API_KEY = "sk-test-secret-12345";
    process.env.TEST_BASE_URL = "https://my-gateway.example.com/v1";
  });

  it("resolves {env:VAR_NAME} placeholders", () => {
    expect(resolveTemplate("{env:TEST_API_KEY}")).toBe("sk-test-secret-12345");
    expect(resolveTemplate("{env:NON_EXISTENT_VAR}")).toBeUndefined();
    expect(resolveTemplate("https://direct-url.com")).toBe("https://direct-url.com");
  });

  it("inherits from host opencode.json provider options", () => {
    const mockHostConfig = {
      image_generation: {
        openai: {
          apiKey: "{env:TEST_API_KEY}",
          baseURL: "{env:TEST_BASE_URL}",
        },
        nanobanana: {
          apiKey: "{env:TEST_API_KEY}",
          baseURL: "{env:TEST_BASE_URL}",
        },
      },
    };

    const config = loadConfiguration(mockHostConfig);
    expect(config.openai.apiKey).toBe("sk-test-secret-12345");
    expect(config.openai.baseURL).toBe("https://my-gateway.example.com/v1");
    expect(config.nanobanana.apiKey).toBe("sk-test-secret-12345");
    expect(config.nanobanana.baseURL).toBe("https://my-gateway.example.com/v1");
  });

  it("prioritizes explicit image_generation custom block over generic provider", () => {
    const mockHostConfig = {
      image_generation: {
        openai: {
          apiKey: "custom-openai-key",
          default_model: "gpt-image-2.5-sunburst",
          available_models: ["gpt-image-2.5-sunburst"],
        },
      },
      provider: {
        openai: {
          options: {
            apiKey: "{env:TEST_API_KEY}",
          },
        },
      },
    };

    const config = loadConfiguration(mockHostConfig);
    expect(config.openai.apiKey).toBe("custom-openai-key");
    expect(config.openai.default_model).toBe("gpt-image-2.5-sunburst");
    expect(config.openai.available_models).toEqual(["gpt-image-2.5-sunburst"]);
  });
});
