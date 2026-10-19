import { afterEach, beforeEach, expect, it } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadConfiguration, resolveTemplate } from "../src/config.js";

let directory: string;
let configDirectory: string;
const originalXdg = process.env.XDG_CONFIG_HOME;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-config-"));
  process.env.XDG_CONFIG_HOME = path.join(directory, "config");
  configDirectory = path.join(process.env.XDG_CONFIG_HOME, "opencode");
  await fs.mkdir(configDirectory, { recursive: true });
});
afterEach(async () => {
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdg;
  await fs.rm(directory, { recursive: true, force: true });
});
const write = (name: string, value: unknown) => fs.writeFile(name, JSON.stringify(value));

it("merges dedicated, global, project overrides by engine and inherits provider credentials", async () => {
  await write(path.join(configDirectory, "opencode.json"), {
    provider: { openai: { options: { apiKey: "inherited-openai", baseURL: "https://openai.example/v1" } }, google: { apiKey: "inherited-google", baseURL: "https://google.example/v1beta" } },
  });
  await write(path.join(configDirectory, "imagegen.json"), { image_generation: {
    openai: { default_model: "dedicated-model" }, nanobanana: { available_models: ["dedicated-nano"], default_model: "dedicated-nano" },
  } });
  await write(path.join(directory, "opencode.json"), { image_generation: { openai: { default_model: "project-model", available_models: ["project-model"] } } });
  const config = loadConfiguration(undefined, directory);
  expect(config.openai.apiKey).toBe("inherited-openai");
  expect(config.openai.default_model).toBe("project-model");
  expect(config.openai.available_models).toEqual(["project-model"]);
  expect(config.nanobanana.apiKey).toBe("inherited-google");
  expect(config.nanobanana.baseURL).toBe("https://google.example/v1beta");
  expect(config.nanobanana.available_models).toEqual(["dedicated-nano"]);
});

it("resolves embedded environment substitutions and rejects malformed config", async () => {
  process.env.IMAGEGEN_TEST_HOST = "gateway.example";
  expect(resolveTemplate("https://{env:IMAGEGEN_TEST_HOST}/v1")).toBe("https://gateway.example/v1");
  delete process.env.IMAGEGEN_TEST_HOST;
  await fs.writeFile(path.join(directory, "opencode.json"), "{ invalid");
  expect(() => loadConfiguration(undefined, directory)).toThrow("Invalid image generation configuration");
});

it("rejects invalid allowlists and keeps explicit host configs isolated from disk", async () => {
  await write(path.join(configDirectory, "imagegen.json"), { openai: { apiKey: "disk-secret" } });
  expect(loadConfiguration({ image_generation: { openai: { apiKey: "host-secret" } } }, directory).openai.apiKey).toBe("host-secret");
  expect(() => loadConfiguration({ image_generation: { openai: { available_models: "bad" } } })).toThrow("available_models");
});
