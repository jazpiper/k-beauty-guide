import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const keepStack = args.has("--keep-stack");
const forceMirror = args.has("--mirror");
const noMirror = args.has("--no-mirror");
const isWindows = process.platform === "win32";
const riskyWindowsPath = isWindows &&
  (/[^\x00-\x7F]|\s/.test(repoRoot) || /(?:OneDrive|Google Drive)/i.test(repoRoot));
const useMirror = forceMirror || (!noMirror && riskyWindowsPath);
const workdir = useMirror ? mirrorRepo() : repoRoot;

let started = false;

try {
  log(`Supabase smoke workdir: ${workdir}`);
  if (useMirror) {
    log("Using a temporary ASCII-path mirror for Docker bind mount compatibility.");
  }

  run("npx", ["supabase", "stop", "--workdir", workdir, "--no-backup"], { allowFailure: true });
  run("npx", ["supabase", "start", "--workdir", workdir], { capture: true, redact: true });
  started = true;
  run("npx", ["supabase", "db", "reset", "--workdir", workdir]);

  const status = run("npx", ["supabase", "status", "--workdir", workdir, "-o", "env"], {
    capture: true,
    quiet: true,
  });
  const anonKey = parseEnvValue(status.stdout, "ANON_KEY") ||
    parseEnvValue(status.stdout, "SUPABASE_ANON_KEY");

  if (!anonKey) {
    throw new Error("Could not read local Supabase anon key from `supabase status -o env`.");
  }

  run("npm", ["run", "smoke:supabase:analyzer"], {
    env: { ...process.env, SUPABASE_ANON_KEY: anonKey },
  });

  log("Supabase local smoke passed.");
} finally {
  if (!keepStack && started) {
    run("npx", ["supabase", "stop", "--workdir", workdir, "--no-backup"], { allowFailure: true });
  }
  if (useMirror && !keepStack) {
    fs.rmSync(workdir, { recursive: true, force: true });
    log(`Removed temporary mirror: ${workdir}`);
  } else if (useMirror) {
    log(`Kept temporary mirror for the running stack: ${workdir}`);
  }
}

function mirrorRepo() {
  const base = isWindows ? "C:\\codex-temp" : os.tmpdir();
  const target = path.join(base, "k-beauty-guide-supabase-smoke");

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  copyDirectory(repoRoot, target);

  return target;
}

function copyDirectory(source, target) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    const relativePath = path.relative(repoRoot, sourcePath).replace(/\\/g, "/");

    if (shouldSkip(relativePath, entry)) continue;

    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function shouldSkip(relativePath, entry) {
  if (entry.isDirectory()) {
    return [
      ".git",
      "node_modules",
      "build",
      "coverage",
      ".cache",
      "supabase/.temp",
      "supabase/.branches",
    ].includes(relativePath);
  }

  return relativePath.endsWith(".log");
}

function parseEnvValue(output, name) {
  const line = output.split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  if (!line) return "";

  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
}

function run(command, commandArgs, options = {}) {
  log(`$ ${command} ${commandArgs.join(" ")}`);

  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: options.env || process.env,
    encoding: "utf8",
    shell: isWindows,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) throw result.error;

  if (options.capture && !options.quiet) {
    if (result.stdout) process.stdout.write(options.redact ? redactOutput(result.stdout) : result.stdout);
    if (result.stderr) process.stderr.write(options.redact ? redactOutput(result.stderr) : result.stderr);
  }

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${result.status}`);
  }

  return result;
}

function redactOutput(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => !/│\s*(Publishable|Secret|Access Key|Secret Key)\s*│/.test(line))
    .join(os.EOL)
    .replace(/(ANON_KEY|SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=.+/g, "$1=<redacted>");
}

function log(message) {
  console.log(`[supabase-smoke] ${message}`);
}
