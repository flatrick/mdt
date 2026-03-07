#!/usr/bin/env node
/**
 * PostToolUse Hook: TypeScript check after editing .ts/.tsx files
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs after Edit tool use on TypeScript files. Walks up from the file's
 * directory to find the nearest tsconfig.json, then runs tsc --noEmit
 * and reports only errors related to the edited file.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { readStdinText, parseJsonObject } = require("../lib/utils");

const MAX_STDIN = 1024 * 1024; // 1MB limit

function shouldTypecheckFile(filePath) {
  return Boolean(filePath && /\.(ts|tsx)$/.test(filePath));
}

function findNearestTsConfigDir(resolvedPath) {
  let dir = path.dirname(resolvedPath);
  const root = path.parse(dir).root;
  let depth = 0;

  while (dir !== root && depth < 20) {
    if (fs.existsSync(path.join(dir, "tsconfig.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
    depth++;
  }

  return fs.existsSync(path.join(dir, "tsconfig.json")) ? dir : null;
}

function runTypecheck(tsConfigDir) {
  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npxBin, ["tsc", "--noEmit", "--pretty", "false"], {
    cwd: tsConfigDir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30000,
  });
}

function getRelevantTypeErrors(errorOutput, tsConfigDir, filePath, resolvedPath) {
  const relPath = path.relative(tsConfigDir, resolvedPath);
  const candidates = new Set([filePath, resolvedPath, relPath]);

  return errorOutput
    .split("\n")
    .filter((line) => {
      for (const candidate of candidates) {
        if (line.includes(candidate)) return true;
      }
      return false;
    })
    .slice(0, 10);
}

function reportRelevantErrors(filePath, relevantLines) {
  if (relevantLines.length === 0) return;

  console.error("[Hook] TypeScript errors in " + path.basename(filePath) + ":");
  relevantLines.forEach((line) => console.error(line));
}

function runTypecheckForFile(filePath) {
  if (!shouldTypecheckFile(filePath)) return;

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) return;

  const tsConfigDir = findNearestTsConfigDir(resolvedPath);
  if (!tsConfigDir) return;

  try {
    runTypecheck(tsConfigDir);
  } catch (error) {
    const output = (error.stdout || "") + (error.stderr || "");
    const relevantLines = getRelevantTypeErrors(output, tsConfigDir, filePath, resolvedPath);
    reportRelevantErrors(filePath, relevantLines);
  }
}

async function runCli() {
  const data = await readStdinText({ timeoutMs: 5000, maxSize: MAX_STDIN });
  const input = parseJsonObject(data);
  const filePath = input.tool_input?.file_path;
  runTypecheckForFile(filePath);
  process.stdout.write(data);
  process.exit(0);
}

runCli().catch(() => {
  process.exit(0);
});
