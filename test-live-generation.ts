import { executeOpenAIImageGen } from "./src/openai.js";
import { executeNanoBananaImageGen } from "./src/nanobanana.js";
import { loadConfiguration } from "./src/config.js";

async function main() {
  console.log("Loading configuration...");
  const config = loadConfiguration();
  console.log("OpenAI config:", {
    enabled: config.openai.enabled,
    default_model: config.openai.default_model,
    baseURL: config.openai.baseURL,
    apiKeySet: bool(config.openai.apiKey),
  });
  console.log("NanoBanana config:", {
    enabled: config.nanobanana.enabled,
    default_model: config.nanobanana.default_model,
    baseURL: config.nanobanana.baseURL,
    apiKeySet: bool(config.nanobanana.apiKey),
  });

  function bool(v: any) {
    return !!v;
  }

  // 1. Test OpenAI Flare
  console.log("\n--- Testing OpenAI Image Gen (gpt-image-2.5-flare) ---");
  try {
    const res = await executeOpenAIImageGen({
      prompt: "A minimalist red square on white background",
      model: "gpt-image-2.5-flare",
      aspect_ratio: "1:1",
    });
    console.log("OpenAI Result:", res);
  } catch (err) {
    console.error("OpenAI Error:", err);
  }

  // 2. Test Gemini Flash
  console.log("\n--- Testing Gemini Nano Banana Gen (gemini-3.1-flash-image) ---");
  try {
    const res = await executeNanoBananaImageGen({
      prompt: "A minimalist blue circle on white background",
      model: "gemini-3.1-flash-image",
      aspect_ratio: "1:1",
    });
    console.log("Gemini Result:", res);
  } catch (err) {
    console.error("Gemini Error:", err);
  }
}

main().catch(console.error);
