#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }
  return args[index + 1];
}

const codexHome = path.resolve(readArg("--codex-home", path.join(os.homedir(), ".codex")));
const sandboxIdentityPattern = readArg("--sandbox-identity-pattern", "CodexSandboxUsers");
const windowsIcaclsPath = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, "System32", "icacls.exe")
  : "C:\\Windows\\System32\\icacls.exe";
const windowsCmdPath = process.env.ComSpec
  || (process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "cmd.exe") : "C:\\Windows\\System32\\cmd.exe");

function info(message) {
  console.log(`[codex-hardening] ${message}`);
}

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.error) {
    if (process.platform === "win32" && result.error.code === "EPERM") {
      throw new Error(
        `Windows blocked Node from spawning '${command}'. Re-run from a normal shell where Node is allowed to launch icacls, or run this through Codex with permission escalation enabled.`
      );
    }
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(stderr || stdout || `${command} exited with status ${result.status}`);
  }
  return result.stdout ?? "";
}

function getIcaclsCommand() {
  return fs.existsSync(windowsIcaclsPath) ? windowsIcaclsPath : "icacls";
}

function runWindowsCommandThroughCmd(command, commandArgs) {
  const escaped = [command, ...commandArgs]
    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
    .join(" ");

  return run(windowsCmdPath, ["/d", "/s", "/c", escaped]);
}

function hardenAuthWindows(authPath) {
  const icacls = getIcaclsCommand();
  info(`Disabling inherited ACLs on ${authPath}`);
  runWindowsCommandThroughCmd(icacls, [authPath, "/inheritance:d"]);

  const aclOutput = runWindowsCommandThroughCmd(icacls, [authPath]);
  const identities = [];

  for (const line of aclOutput.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]+):/);
    if (match && match[1].includes(sandboxIdentityPattern)) {
      identities.push(match[1].trim());
    }
  }

  for (const identity of [...new Set(identities)]) {
    info(`Removing ACL entry '${identity}' from ${authPath}`);
    runWindowsCommandThroughCmd(icacls, [authPath, "/remove:g", identity]);
  }
}

function hardenAuthPosix(authPath) {
  info(`Setting mode 600 on ${authPath}`);
  fs.chmodSync(authPath, 0o600);
}

function hardenAuth(authPath) {
  if (!fs.existsSync(authPath)) {
    info("Skipping auth hardening because auth.json is missing");
    return;
  }

  if (process.platform === "win32") {
    hardenAuthWindows(authPath);
    return;
  }

  hardenAuthPosix(authPath);
}

ensureExists(codexHome, "Codex home");

const authPath = path.join(codexHome, "auth.json");

hardenAuth(authPath);

info("Hardening complete");
