import fs from "node:fs/promises";

const result = await Bun.build({
  entrypoints: [new URL("../src/index.ts", import.meta.url).pathname],
  outdir: new URL("../dist", import.meta.url).pathname,
  target: "node",
  external: ["@opencode/plugin"],
});
if (!result.success) throw new AggregateError(result.logs, "Plugin build failed");
const pkg = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
await fs.writeFile(new URL("../dist/package.json", import.meta.url), JSON.stringify({
  name: pkg.name, version: pkg.version, private: true, type: "module",
  main: "./index.js", exports: "./index.js", peerDependencies: pkg.peerDependencies,
}, null, 2) + "\n");
console.log("Built dist/index.js and dist/package.json");
