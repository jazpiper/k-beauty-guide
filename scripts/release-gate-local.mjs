import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserSecretPattern = /service[_-]?role|SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i;
const browserScanTargets = ["src", "public", ".env.example"];
const requiredPackageScripts = {
  build: "node ./node_modules/react-scripts/bin/react-scripts.js build",
  test: "node ./node_modules/react-scripts/bin/react-scripts.js test",
  "smoke:supabase:analyzer": "node scripts/smoke-supabase-analyzer.mjs",
  "smoke:supabase:functions": "node scripts/smoke-supabase-functions.mjs",
  "smoke:supabase:local": "node scripts/smoke-supabase-local.mjs",
};
const requiredRunbookReferences = [
  "npm run build",
  "CI=true npm test -- --watch=false --passWithNoTests",
  "npm run smoke:supabase:local",
  "npm run release:local",
];

const failures = [];

scanBrowserTargets();
checkPackageScripts();
checkRunbookReferences();
runRequiredCommand("npm", ["run", "test:crawler"]);
runRequiredCommand("npm", ["run", "smoke:supabase:local"]);

if (failures.length > 0) {
  console.error("Local release gate failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "No service role references found in browser scan targets.",
    "Required build/test/Supabase smoke package scripts are present.",
    "Deployment runbook references local release, build, test, and smoke commands.",
    "`npm run test:crawler` passed.",
    "`npm run smoke:supabase:local` passed.",
  ],
  stagingBoundary: "Staging Supabase migration/function deploy and Vercel preview deploy require linked project credentials; this local gate does not deploy. Run Docker build/test separately for frontend release evidence.",
}, null, 2));

function scanBrowserTargets() {
  for (const target of browserScanTargets) {
    const absoluteTarget = path.join(repoRoot, target);

    if (!fs.existsSync(absoluteTarget)) continue;

    const entries = fs.statSync(absoluteTarget).isDirectory()
      ? listFiles(absoluteTarget)
      : [absoluteTarget];

    for (const filePath of entries) {
      const relativePath = path.relative(repoRoot, filePath);
      const content = fs.readFileSync(filePath, "utf8");

      if (browserSecretPattern.test(content)) {
        failures.push(`Secret-like service role reference found in ${relativePath}`);
      }
    }
  }
}

function checkPackageScripts() {
  const packagePath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const scripts = packageJson.scripts ?? {};

  for (const [name, expected] of Object.entries(requiredPackageScripts)) {
    if (scripts[name] !== expected) {
      failures.push(`package.json script "${name}" must be "${expected}"`);
    }
  }
}

function checkRunbookReferences() {
  const runbookPath = path.join(repoRoot, "docs", "ops", "01-deployment-runbook.md");
  const runbook = fs.readFileSync(runbookPath, "utf8");

  for (const command of requiredRunbookReferences) {
    if (!runbook.includes(command)) {
      failures.push(`Deployment runbook must reference \`${command}\``);
    }
  }
}

function listFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(filePath));
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }

  return files;
}

function runRequiredCommand(command, args) {
  console.log(`[release-gate] $ ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    failures.push(`${command} ${args.join(" ")} failed to start: ${result.error.message}`);
    return;
  }

  if (result.status !== 0) {
    failures.push(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
}
