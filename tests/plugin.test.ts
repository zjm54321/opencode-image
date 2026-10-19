import { expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import plugin from "../src/index.js";

it("registers independent Zod tools and returns the native V2 Tool.Result envelope", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-plugin-"));
  const tools: any[] = [];
  let disposed = false;
  const originalXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = path.join(directory, "config");
  try {
    await fs.writeFile(path.join(directory, "opencode.json"), JSON.stringify({ image_generation: { openai: { enabled: false }, nanobanana: { enabled: false } } }));
    const cleanup = await plugin.setup({
      location: { directory },
      tool: { transform: async (callback: any) => {
        callback({ add: (tool: any) => tools.push(tool) });
        return { dispose: () => { disposed = true; } };
      } },
    } as any);
    expect(tools.map(tool => tool.name)).toEqual(["image_gen", "image_gen_nano"]);
    expect(Object.keys(tools[0].input.shape)).not.toContain("session_id");
    expect(Object.keys(tools[1].input.shape)).not.toContain("transparent_background");
    expect(tools[0].input.safeParse({ prompt: "a", num_last_images_to_include: 0 }).success).toBe(true);
    expect(tools[0].input.safeParse({ prompt: "a", session_id: "nano-only" }).success).toBe(false);
    expect(tools[1].input.safeParse({ prompt: "a", transparent_background: true }).success).toBe(false);
    for (const tool of tools) {
      const result = await tool.execute({ prompt: "test" }, { sessionID: "session", signal: new AbortController().signal });
      expect(typeof result.content).toBe("string");
      expect(JSON.parse(result.content).error_code).toBe("PROVIDER_DISABLED");
    }
    await cleanup?.();
    expect(disposed).toBe(true);
  } finally {
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
