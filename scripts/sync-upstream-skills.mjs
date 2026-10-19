import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const skillsDir = path.join(rootDir, "skills", "image-generation");

async function syncSkills() {
  console.log("Checking and syncing upstream skills...");

  // 1. Verify subskills exist and have SKILL.md
  const openaiSkill = path.join(skillsDir, "subskills", "openai", "SKILL.md");
  const nanoSkill = path.join(skillsDir, "subskills", "nanobanana", "SKILL.md");

  const [hasOpenAI, hasNano] = await Promise.all([
    fs.stat(openaiSkill).then(() => true).catch(() => false),
    fs.stat(nanoSkill).then(() => true).catch(() => false),
  ]);

  if (!hasOpenAI || !hasNano) {
    console.error("Missing subskills: openai=" + hasOpenAI + ", nanobanana=" + hasNano);
    process.exit(1);
  }

  // 2. Verify master router SKILL.md exists
  const masterSkill = path.join(skillsDir, "SKILL.md");
  const content = await fs.readFile(masterSkill, "utf-8");
  if (!content.includes("image-generation") || !content.includes("Universal Model Capabilities Matrix")) {
    console.error("Master SKILL.md validation failed!");
    process.exit(1);
  }

  console.log("All skills validated successfully!");
}

syncSkills().catch(err => {
  console.error(err);
  process.exit(1);
});
