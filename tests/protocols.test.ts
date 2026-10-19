import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeOpenAIImageGen } from "../src/openai.js";
import { executeNanoBananaImageGen } from "../src/nanobanana.js";
import { conversationImagePaths } from "../src/images.js";
import { loadConfiguration } from "../src/config.js";

const originalFetch = globalThis.fetch;
const imageData = Buffer.from("fixture-image-bytes").toString("base64");
let directory: string;
const requests: { url: string; init: RequestInit }[] = [];

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-test-"));
  requests.length = 0;
  loadConfiguration({ image_generation: {
    openai: { apiKey: "test-key", baseURL: "https://openai.example/v1" },
    nanobanana: { apiKey: "test-key", baseURL: "https://google.example/v1beta/models" },
  } });
  globalThis.fetch = (async (url: any, init: RequestInit) => {
    requests.push({ url: String(url), init });
    return Response.json(String(url).includes(":generateContent") ? {
      candidates: [{ content: { parts: [
        { text: "description" },
        { inlineData: { mimeType: "image/jpeg", data: imageData }, thoughtSignature: "signature" },
        { inlineData: { mimeType: "image/jpeg", data: "dGhvdWdodA==" }, thought: true },
      ] } }],
    } : { data: [{ b64_json: imageData }] });
  }) as typeof fetch;
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await fs.rm(directory, { recursive: true, force: true });
});

function resultPath(result: string): string {
  return result.match(/\]\(([^)]+)\)/)![1];
}

describe("separate engine wire protocols", () => {
  it("sends OpenAI generation parameters and only returns a relative preview", async () => {
    const result = await executeOpenAIImageGen({ prompt: "hello ](not-a-link)", aspect_ratio: "16:9", transparent_background: true, quality: "high" }, directory);
    expect(requests[0].url).toBe("https://openai.example/v1/images/generations");
    const payload = JSON.parse(requests[0].init.body as string);
    expect(payload).toMatchObject({ size: "1536x864", background: "transparent", output_format: "png", quality: "high" });
    expect(payload.response_format).toBeUndefined();
    expect(result).not.toContain("base64");
    expect(result).not.toContain(directory);
    expect(result).not.toContain("hello");
    expect(resultPath(result)).toStartWith(".opencode/generated-images/openai/");
    expect(await fs.readFile(path.join(directory, resultPath(result)), "utf8")).toBe("fixture-image-bytes");
  });

  it("edits with all references, correct MIME types and generation parameters", async () => {
    await fs.writeFile(path.join(directory, "one.png"), "png");
    await fs.writeFile(path.join(directory, "two.jpg"), "jpeg");
    await executeOpenAIImageGen({ prompt: "edit", referenced_image_paths: ["one.png", "two.jpg"], quality: "high", aspect_ratio: "9:16", transparent_background: true }, directory);
    expect(requests[0].url).toEndWith("/images/edits");
    const form = requests[0].init.body as FormData;
    expect(form.getAll("image[]")).toHaveLength(2);
    expect((form.getAll("image[]")[1] as Blob).type).toBe("image/jpeg");
    expect(form.get("quality")).toBe("high");
    expect(form.get("size")).toBe("864x1536");
    expect(form.get("background")).toBe("transparent");
  });

  it("includes recent conversation images rather than ignoring the count", async () => {
    await fs.writeFile(path.join(directory, "previous.png"), "previous");
    await executeOpenAIImageGen({ prompt: "edit", num_last_images_to_include: 1 }, directory, { recentImagePaths: ["previous.png"] });
    expect(requests[0].url).toEndWith("/images/edits");
    const result = await executeOpenAIImageGen({ prompt: "edit", num_last_images_to_include: 2 }, directory, { recentImagePaths: ["previous.png"] });
    expect(JSON.parse(result).error_code).toBe("INVALID_ARGUMENT");
    expect(requests).toHaveLength(1);
  });

  it("uses native Gemini contents/imageConfig and extracts the final non-thought JPEG", async () => {
    await fs.writeFile(path.join(directory, "reference.webp"), "webp");
    const result = await executeNanoBananaImageGen({ prompt: "poster", aspect_ratio: "16:9", resolution: "2K", referenced_image_paths: ["reference.webp"] }, directory);
    expect(requests[0].url).toBe("https://google.example/v1beta/models/gemini-3.1-flash-image:generateContent");
    const payload = JSON.parse(requests[0].init.body as string);
    expect(payload.contents[0].parts[0].inlineData.mimeType).toBe("image/webp");
    expect(payload.contents[0].parts[1]).toEqual({ text: "poster" });
    expect(payload.generationConfig).toEqual({ responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: "2K" } });
    expect(requests[0].init.headers).toMatchObject({ "x-goog-api-key": "test-key" });
    expect(resultPath(result)).toStartWith(".opencode/generated-images/nano/");
    expect(resultPath(result)).toEndWith(".jpg");
    expect(await fs.readFile(path.join(directory, resultPath(result)), "utf8")).toBe("fixture-image-bytes");
  });

  it("carries the prior image and thought signature within a Nano session only", async () => {
    await executeNanoBananaImageGen({ prompt: "first", session_id: "series" }, directory);
    await executeNanoBananaImageGen({ prompt: "second", session_id: "series" }, directory);
    const continued = JSON.parse(requests[1].init.body as string);
    expect(continued.contents).toHaveLength(3);
    expect(continued.contents[1].role).toBe("model");
    expect(continued.contents[1].parts[0].thoughtSignature).toBe("signature");
    expect(continued.contents[1].parts[0].inlineData.data).toBe(imageData);
    await executeNanoBananaImageGen({ prompt: "unrelated", session_id: "different" }, directory);
    expect(JSON.parse(requests[2].init.body as string).contents).toHaveLength(1);
  });

  it("uses native 512 sizing for half-K and omits imageSize for fixed-resolution legacy models", async () => {
    await executeNanoBananaImageGen({ prompt: "draft", resolution: "0.5K" }, directory);
    expect(JSON.parse(requests[0].init.body as string).generationConfig.imageConfig.imageSize).toBe("512");
    await executeNanoBananaImageGen({ prompt: "legacy", model: "gemini-2.5-flash-image" }, directory);
    expect(JSON.parse(requests[1].init.body as string).generationConfig.imageConfig.imageSize).toBeUndefined();
  });

  it("rejects missing references in either engine instead of silently generating unrelated images", async () => {
    for (const execute of [executeOpenAIImageGen, executeNanoBananaImageGen]) {
      const result = await execute({ prompt: "edit", referenced_image_paths: ["missing.png"] }, directory);
      expect(JSON.parse(result).error_code).toBe("EXECUTION_EXCEPTION");
    }
    expect(requests).toHaveLength(0);
  });

  it("enforces model capabilities without a network call", async () => {
    expect(JSON.parse(await executeOpenAIImageGen({ prompt: "test", model: "gpt-image-2", transparent_background: true }, directory)).error_code).toBe("INVALID_ARGUMENT");
    expect(JSON.parse(await executeNanoBananaImageGen({ prompt: "test", model: "gemini-3.1-flash-lite-image", resolution: "4K" }, directory)).error_code).toBe("INVALID_ARGUMENT");
    expect(requests).toHaveLength(0);
  });

  it("returns structured HTTP, empty response and write errors", async () => {
    globalThis.fetch = (async () => new Response("rate limit", { status: 429 })) as typeof fetch;
    expect(JSON.parse(await executeNanoBananaImageGen({ prompt: "test" }, directory)).error_code).toBe("HTTP_429");
    globalThis.fetch = (async () => Response.json({})) as typeof fetch;
    expect(JSON.parse(await executeOpenAIImageGen({ prompt: "test" }, directory)).error_code).toBe("EMPTY_RESULT");
    expect(JSON.parse(await executeNanoBananaImageGen({ prompt: "test" }, directory)).error_code).toBe("EMPTY_RESULT");
    await fs.writeFile(path.join(directory, ".opencode"), "not a directory");
    globalThis.fetch = (async () => Response.json({ data: [{ b64_json: imageData }] })) as typeof fetch;
    expect(JSON.parse(await executeOpenAIImageGen({ prompt: "test" }, directory)).error_code).toBe("EXECUTION_EXCEPTION");
  });

  it("extracts local conversation attachments and Markdown without remote downloads", () => {
    expect(conversationImagePaths([
      { parts: [{ type: "file", mime: "image/png", uri: "file:///workspace/one.png" }] },
      { state: { result: { content: "![Generated image](.opencode/generated-images/openai/two.png)" }, input: { prompt: "![not-output](ignored.png)" } } },
      { content: "![remote](https://example.com/image.png)" },
    ])).toEqual(["/workspace/one.png", ".opencode/generated-images/openai/two.png"]);
  });

  it("includes native V2 base64 user attachments as recent images", async () => {
    const recentImagePaths = conversationImagePaths([{ type: "user", text: "Edit this", files: [{ mime: "image/png", data: imageData, source: { type: "inline" } }] }]);
    expect(recentImagePaths).toEqual([`data:image/png;base64,${imageData}`]);
    await executeOpenAIImageGen({ prompt: "edit attachment", num_last_images_to_include: 1 }, directory, { recentImagePaths });
    const form = requests[0].init.body as FormData;
    expect(await (form.get("image[]") as Blob).text()).toBe("fixture-image-bytes");
  });
});
