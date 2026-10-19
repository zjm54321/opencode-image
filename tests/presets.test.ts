import { describe, it, expect } from "bun:test";
import { BUILTIN_MODEL_PRESETS, ASPECT_RATIO_TO_PIXELS, snapTo16Pixels } from "../src/presets.js";

describe("presets and geometry constraints", () => {
  it("contains universal models for both OpenAI and Gemini", () => {
    expect(BUILTIN_MODEL_PRESETS["gpt-image-2.5-flare"]).toBeDefined();
    expect(BUILTIN_MODEL_PRESETS["gpt-image-2.5-sunburst"]).toBeDefined();
    expect(BUILTIN_MODEL_PRESETS["gemini-3.1-flash-image"]).toBeDefined();
    expect(BUILTIN_MODEL_PRESETS["gemini-3-pro-image"]).toBeDefined();
  });

  it("correctly identifies transparency support", () => {
    expect(BUILTIN_MODEL_PRESETS["gpt-image-2.5-flare"].supportsTransparency).toBe(true);
    expect(BUILTIN_MODEL_PRESETS["gpt-image-2.5-sunburst"].supportsTransparency).toBe(true);
    expect(BUILTIN_MODEL_PRESETS["gpt-image-2"].supportsTransparency).toBe(false);
    expect(BUILTIN_MODEL_PRESETS["gemini-3.1-flash-image"].supportsTransparency).toBe(false);
  });

  it("maps visual aspect ratios to 16-multiple pixel dimensions", () => {
    expect(ASPECT_RATIO_TO_PIXELS["1:1"]).toBe("1024x1024");
    expect(ASPECT_RATIO_TO_PIXELS["16:9"]).toBe("1536x1024");
    expect(ASPECT_RATIO_TO_PIXELS["9:16"]).toBe("1024x1536");
  });

  it("snaps arbitrary dimensions to valid 16 multiples within bounds", () => {
    const snapped = snapTo16Pixels(1500, 1000);
    expect(snapped.width % 16).toBe(0);
    expect(snapped.height % 16).toBe(0);
    expect(snapped.width).toBe(1504);
    expect(snapped.height).toBe(1008);
  });
});
