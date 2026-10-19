import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(root, "skills/image-generation");
const upstreams = [
  { name: "openai", repository: "https://github.com/openai/skills.git", directory: "skills/.system/imagegen" },
  { name: "nanobanana", repository: "https://github.com/AntonioCardenas/generate-nanobanana.git", directory: "." },
];
async function download(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Upstream download failed: ${response.status} ${url}`);
  return response;
}

async function digestTree(directory, relative = "") {
  const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
  const result = {};
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await digestTree(directory, name));
    else if (entry.isFile()) result[name] = crypto.createHash("sha256").update(await fs.readFile(path.join(directory, name))).digest("hex");
    else throw new Error(`Unexpected non-regular upstream file: ${name}`);
  }
  return result;
}

export async function syncSkills(check = process.argv.includes("--check")) {
  const master = await fs.readFile(path.join(skillRoot, "SKILL.md"), "utf8");
  if (!master.includes("Universal Model Capabilities Matrix")) throw new Error("Missing master routing matrix");
  const manifestPath = path.join(skillRoot, "upstreams.json");
  if (check) {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    for (const upstream of upstreams) {
      const actual = await digestTree(path.join(skillRoot, "subskills", upstream.name));
      const expected = manifest[upstream.name]?.files ?? {};
      if (Object.keys(actual).length !== Object.keys(expected).length || Object.entries(actual).some(([name, hash]) => expected[name] !== hash)) {
        throw new Error(`Upstream snapshot modified or incomplete: ${upstream.name}`);
      }
    }
    console.log("Both complete upstream snapshots match their recorded SHA-256 manifests.");
    return;
  }
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-skills-"));
  try {
    const manifest = {};
    // Stage and validate both snapshots before changing the vendored copies.
    for (const upstream of upstreams) {
      const repository = new URL(upstream.repository).pathname.replace(/^\//, "").replace(/\.git$/, "");
      const headers = { "User-Agent": "opencode-imagegen-skill-sync", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
      const metadata = await (await download(`https://api.github.com/repos/${repository}/commits/HEAD`, headers)).json();
      const commit = metadata.sha;
      if (!/^[a-f\d]{40}$/.test(commit)) throw new Error(`Invalid upstream commit for ${repository}`);
      const archive = await download(`https://codeload.github.com/${repository}/tar.gz/${commit}`);
      const archivePath = path.join(temporary, `${upstream.name}.tar.gz`);
      await fs.writeFile(archivePath, Buffer.from(await archive.arrayBuffer()));
      const entries = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf8" }).trim().split("\n");
      if (entries.some(entry => entry.startsWith("/") || entry.split("/").includes(".."))) throw new Error("Unsafe upstream archive path");
      const checkout = path.join(temporary, upstream.name);
      await fs.mkdir(checkout);
      execFileSync("tar", ["-xzf", archivePath, "--strip-components=1", "--no-same-owner", "-C", checkout]);
      const source = path.join(checkout, upstream.directory);
      await fs.access(path.join(source, "SKILL.md"));
      const staged = path.join(temporary, `${upstream.name}-staged`);
      await fs.cp(source, staged, { recursive: true, filter: filename => path.basename(filename) !== ".git" });
      manifest[upstream.name] = {
        repository: upstream.repository, directory: upstream.directory,
        commit, files: await digestTree(staged),
      };
    }
    for (const upstream of upstreams) {
      const destination = path.join(skillRoot, "subskills", upstream.name);
      await fs.rm(destination, { recursive: true, force: true });
      await fs.cp(path.join(temporary, `${upstream.name}-staged`), destination, { recursive: true });
      console.log(`Synced ${upstream.name} at ${manifest[upstream.name].commit}`);
    }
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncSkills().catch(error => { console.error(error.message); process.exitCode = 1; });
}
