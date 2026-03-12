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
const windowsIcaclsPath = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, "System32", "icacls.exe")
  : "C:\\Windows\\System32\\icacls.exe";
const windowsCmdPath = process.env.ComSpec
  || (process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "cmd.exe") : "C:\\Windows\\System32\\cmd.exe");

function check(message) {
  console.log(`[verify] ${message}`);
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

const authPath = path.join(codexHome, "auth.json");

if (fs.existsSync(authPath)) {
  check("Permission state for auth.json");
  if (process.platform === "win32") {
    process.stdout.write(runWindowsCommandThroughCmd(getIcaclsCommand(), [authPath]));
  } else {
    const mode = fs.statSync(authPath).mode & 0o777;
    console.log(`${authPath} mode=${mode.toString(8)}`);
    if (mode === 0o600) {
      console.log("OK: auth.json is owner-only");
    } else {
      console.log("WARN: auth.json is not mode 600");
    }
  }
  console.log("");
}
