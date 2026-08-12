#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DEFAULT_CONFIG_PATH,
  expandPathVariables,
  parseConfig,
  PROJECT_ROOT,
  resolveConfiguredPath
} from "./config.mjs";
import { AgentDocError, errorPayload } from "./errors.mjs";
import { findPrompts } from "./prompt-service.mjs";
import { checkConfiguration, searchDocuments } from "./search-service.mjs";
import { findSecrets, inspectSecretPath } from "./secret-service.mjs";
import { findTools } from "./tool-service.mjs";

const UI_DIRECTORY = path.join(PROJECT_ROOT, "ui");
const WINDOWS_DROP_TARGET = path.join(PROJECT_ROOT, "scripts", "windows-drop-target.ps1");
const MAX_REQUEST_BYTES = 6_000_000;
const MAX_PATH_VALIDATION_ENTRIES = 1_000;
const NATIVE_DROP_TIMEOUT_MS = 120_000;
const DEFAULT_PORT = 43120;
const LOOPBACK_HOST = "127.0.0.1";

const STATIC_FILES = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }]
]);

function securityHeaders(contentType) {
  return {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "content-type": contentType,
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, securityHeaders("application/json; charset=utf-8"));
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendError(response, error) {
  const statusCode = error instanceof AgentDocError ? 400 : 500;
  sendJson(response, statusCode, errorPayload(error));
}

async function readJsonBody(request) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AgentDocError("UI_CONTENT_TYPE_INVALID", "UI API requests must use application/json.");
  }

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_REQUEST_BYTES) {
      throw new AgentDocError("UI_REQUEST_TOO_LARGE", `UI request exceeds ${MAX_REQUEST_BYTES} bytes.`);
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw new AgentDocError("UI_JSON_INVALID", "UI request body is not valid JSON.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function validToken(request, sessionToken) {
  const provided = request.headers["x-agent-doc-token"];
  if (typeof provided !== "string") {
    return false;
  }
  const expectedBuffer = Buffer.from(sessionToken);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

async function readRawConfig(configPath) {
  let text;
  try {
    text = await fs.readFile(configPath, "utf8");
  } catch (error) {
    throw new AgentDocError("CONFIG_NOT_FOUND", `Cannot read search configuration: ${configPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AgentDocError("CONFIG_JSON_INVALID", `Search configuration is not valid JSON: ${configPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

async function writeValidatedConfig(configPath, rawConfig) {
  await parseConfig(rawConfig, configPath);

  const serialized = `${JSON.stringify(rawConfig, null, 2)}\n`;
  const backupPath = `${configPath}.bak`;
  const temporaryPath = `${configPath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  let backupCreated = false;

  try {
    await fs.copyFile(configPath, backupPath);
    backupCreated = true;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new AgentDocError("CONFIG_BACKUP_FAILED", `Cannot back up search configuration: ${backupPath}`, {
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  try {
    await fs.writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx" });
    try {
      await fs.rename(temporaryPath, configPath);
    } catch (error) {
      if (process.platform !== "win32" || !["EEXIST", "EPERM"].includes(error?.code)) {
        throw error;
      }
      await fs.copyFile(temporaryPath, configPath);
      await fs.unlink(temporaryPath);
    }
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw new AgentDocError("CONFIG_WRITE_FAILED", `Cannot save search configuration: ${configPath}`, {
      cause: error instanceof Error ? error.message : String(error),
      ...(backupCreated ? { backupPath } : {})
    });
  }

  return { backupCreated, backupPath: backupCreated ? backupPath : null };
}

export function createNativePickerScript(kind) {
  const common = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen",
    "$owner.ClientSize = New-Object System.Drawing.Size(1, 1)",
    "$owner.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None",
    "$owner.ShowInTaskbar = $false",
    "$owner.TopMost = $true",
    "$owner.Opacity = 0"
  ];

  if (kind === "directory") {
    return [...common,
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "$dialog.Description = 'Choose a folder that the AI may search'",
      "$dialog.ShowNewFolderButton = $false",
      "$selectedPath = $null",
      "try { $owner.Show(); $owner.Activate(); $owner.BringToFront(); if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $selectedPath = $dialog.SelectedPath } } finally { $dialog.Dispose(); $owner.Close(); $owner.Dispose() }",
      "if (-not [string]::IsNullOrWhiteSpace($selectedPath)) { [Console]::Write($selectedPath) }"
    ].join("; ");
  }
  if (kind === "file" || kind === "secret-file") {
    const secret = kind === "secret-file";
    return [...common,
      "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
      secret
        ? "$dialog.Title = 'Choose one exact secret file for the AI agent'"
        : "$dialog.Title = 'Choose an exact file that the AI may search and fetch'",
      secret
        ? "$dialog.Filter = 'Secret and environment files|.env;*.env;*.txt;*.key;*.pem|All files|*.*'"
        : "$dialog.Filter = 'Text and documentation files|*.md;*.json;*.txt;*.yaml;*.yml|All files|*.*'",
      "$dialog.CheckFileExists = $true",
      "$dialog.RestoreDirectory = $true",
      "$selectedPath = $null",
      "try { $owner.Show(); $owner.Activate(); $owner.BringToFront(); if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $selectedPath = $dialog.FileName } } finally { $dialog.Dispose(); $owner.Close(); $owner.Dispose() }",
      "if (-not [string]::IsNullOrWhiteSpace($selectedPath)) { [Console]::Write($selectedPath) }"
    ].join("; ");
  }
  throw new AgentDocError("UI_PICKER_KIND_INVALID", "Picker kind must be 'file', 'secret-file', or 'directory'.");
}

async function showNativePicker(kind) {
  if (process.platform !== "win32") {
    throw new AgentDocError("UI_PICKER_UNAVAILABLE", "Native file and folder pickers are currently available on Windows only.");
  }

  const powershell = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return new Promise((resolve, reject) => {
    const child = spawn(powershell, ["-NoLogo", "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", createNativePickerScript(kind)], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;

    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > 64_000) {
        child.kill();
        reject(new AgentDocError("UI_PICKER_OUTPUT_TOO_LARGE", "Native picker returned too much data."));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => reject(new AgentDocError("UI_PICKER_FAILED", "Cannot start the native picker.", {
      cause: error instanceof Error ? error.message : String(error)
    })));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new AgentDocError("UI_PICKER_FAILED", "Native picker did not complete successfully.", {
          cause: Buffer.concat(stderr).toString("utf8").trim() || `PowerShell exited with code ${code}.`
        }));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8").trim());
    });
  });
}

export async function classifyDroppedPaths(pathsInput) {
  if (!Array.isArray(pathsInput)) {
    throw new AgentDocError("UI_DROP_PATHS_INVALID", "Dropped paths must be provided as an array.");
  }
  if (pathsInput.length > 100) {
    throw new AgentDocError("UI_DROP_PATHS_LIMIT", "A single drop can contain at most 100 files and folders.");
  }

  const items = [];
  const errors = [];
  const seen = new Set();
  for (const value of pathsInput) {
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push({ path: typeof value === "string" ? value : null, code: "PATH_EMPTY", message: "Dropped path is empty." });
      continue;
    }

    const droppedPath = value.trim();
    if (!path.isAbsolute(droppedPath)) {
      errors.push({ path: droppedPath, code: "PATH_NOT_ABSOLUTE", message: "Dropped path is not absolute." });
      continue;
    }

    const resolvedPath = path.resolve(droppedPath);
    const comparable = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
    if (seen.has(comparable)) {
      continue;
    }
    seen.add(comparable);

    try {
      const fileStat = await fs.lstat(resolvedPath);
      if (fileStat.isSymbolicLink()) {
        errors.push({ path: resolvedPath, code: "PATH_LINK_NOT_ALLOWED", message: "Links and junctions cannot be added." });
        continue;
      }
      const realPath = await fs.realpath(resolvedPath);
      if (fileStat.isDirectory()) {
        items.push({ path: realPath, type: "directory" });
      } else if (fileStat.isFile()) {
        items.push({ path: realPath, type: "file" });
      } else {
        errors.push({ path: realPath, code: "PATH_TYPE_UNSUPPORTED", message: "Only regular files and folders can be added." });
      }
    } catch (error) {
      errors.push({
        path: resolvedPath,
        code: "PATH_UNAVAILABLE",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { items, errors };
}

async function verifyReadablePath(resolvedPath, expectedKind) {
  const pathStat = await fs.lstat(resolvedPath);
  if (pathStat.isSymbolicLink()) {
    return {
      valid: false,
      code: "PATH_LINK_NOT_ALLOWED",
      message: "Links and junctions are not valid configured paths.",
      actualType: "link"
    };
  }

  const actualType = pathStat.isDirectory() ? "directory" : pathStat.isFile() ? "file" : "other";
  if (actualType !== expectedKind) {
    return {
      valid: false,
      code: "PATH_TYPE_MISMATCH",
      message: expectedKind === "directory"
        ? `Expected a directory but found ${actualType === "file" ? "a file" : "an unsupported filesystem entry"}.`
        : `Expected a regular file but found ${actualType === "directory" ? "a directory" : "an unsupported filesystem entry"}.`,
      actualType
    };
  }

  const realPath = await fs.realpath(resolvedPath);
  if (expectedKind === "directory") {
    const directory = await fs.opendir(realPath);
    await directory.close();
  } else {
    const file = await fs.open(realPath, "r");
    await file.close();
  }

  return { valid: true, code: "PATH_VALID", message: `Valid ${expectedKind}.`, actualType, path: realPath };
}

export async function validateUiPaths(entriesInput, options = {}) {
  if (!Array.isArray(entriesInput)) {
    throw new AgentDocError("UI_PATH_ENTRIES_INVALID", "Path validation entries must be provided as an array.");
  }
  if (entriesInput.length > MAX_PATH_VALIDATION_ENTRIES) {
    throw new AgentDocError(
      "UI_PATH_ENTRIES_LIMIT",
      `At most ${MAX_PATH_VALIDATION_ENTRIES} paths can be validated at once.`
    );
  }

  const configuredPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const configPath = path.resolve(expandPathVariables(configuredPath));
  const configDirectory = path.dirname(configPath);
  const seenIds = new Set();
  const entries = [];

  for (const [index, entry] of entriesInput.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AgentDocError("UI_PATH_ENTRY_INVALID", `Path validation entry ${index + 1} must be an object.`);
    }
    if (typeof entry.id !== "string" || !entry.id.trim() || entry.id.length > 200) {
      throw new AgentDocError("UI_PATH_ENTRY_ID_INVALID", `Path validation entry ${index + 1} needs an id of at most 200 characters.`);
    }
    const id = entry.id.trim();
    if (seenIds.has(id)) {
      throw new AgentDocError("UI_PATH_ENTRY_ID_DUPLICATE", `Path validation id '${id}' is used more than once.`);
    }
    seenIds.add(id);

    if (!["directory", "file"].includes(entry.kind)) {
      throw new AgentDocError("UI_PATH_ENTRY_KIND_INVALID", `Path validation entry '${id}' must expect a directory or file.`);
    }
    if (typeof entry.path !== "string" || entry.path.length > 32_768) {
      throw new AgentDocError("UI_PATH_ENTRY_PATH_INVALID", `Path validation entry '${id}' needs a string path of at most 32768 characters.`);
    }
    if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") {
      throw new AgentDocError("UI_PATH_ENTRY_ENABLED_INVALID", `Path validation entry '${id}' has an invalid enabled state.`);
    }

    const inputPath = entry.path.trim();
    const base = { id, kind: entry.kind, inputPath, enabled: entry.enabled !== false };
    if (!inputPath) {
      entries.push({
        ...base,
        path: null,
        valid: false,
        code: "PATH_EMPTY",
        message: entry.kind === "directory" ? "Directory path is required." : "File path is required.",
        actualType: null
      });
      continue;
    }

    let resolvedPath;
    try {
      resolvedPath = resolveConfiguredPath(inputPath, configDirectory);
      const result = await verifyReadablePath(resolvedPath, entry.kind);
      entries.push({ ...base, path: result.path ?? resolvedPath, ...result });
    } catch (error) {
      entries.push({
        ...base,
        path: resolvedPath ?? null,
        valid: false,
        code: "PATH_UNAVAILABLE",
        message: error instanceof Error ? error.message : String(error),
        actualType: null
      });
    }
  }

  const validCount = entries.filter((entry) => entry.valid).length;
  const invalidEntries = entries.filter((entry) => !entry.valid);
  const enabledInvalidCount = invalidEntries.filter((entry) => entry.enabled).length;
  const disabledInvalidCount = invalidEntries.length - enabledInvalidCount;
  return {
    schemaVersion: "1.0",
    ok: true,
    configPath,
    entries,
    summary: {
      total: entries.length,
      valid: validCount,
      invalid: invalidEntries.length,
      enabledInvalid: enabledInvalidCount,
      disabledInvalid: disabledInvalidCount
    }
  };
}

export function createNativeDropTargetManager({
  platform = process.platform,
  powershellPath = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
  scriptPath = WINDOWS_DROP_TARGET,
  spawnProcess = spawn,
  timeoutMs = NATIVE_DROP_TIMEOUT_MS
} = {}) {
  let active = null;

  const show = () => {
    if (platform !== "win32") {
      return Promise.reject(new AgentDocError(
        "UI_DROP_TARGET_UNAVAILABLE",
        "The native drag-and-drop window is currently available on Windows only."
      ));
    }
    if (active) {
      return active.promise;
    }

    const state = { child: null, promise: null };
    const processPromise = new Promise((resolve, reject) => {
      try {
        state.child = spawnProcess(powershellPath, [
          "-NoLogo",
          "-NoProfile",
          "-STA",
          "-WindowStyle",
          "Hidden",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath
        ], {
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        reject(new AgentDocError("UI_DROP_TARGET_FAILED", "Cannot start the native drag-and-drop window.", {
          cause: error instanceof Error ? error.message : String(error)
        }));
        return;
      }

      const child = state.child;
      const stdout = [];
      const stderr = [];
      let outputBytes = 0;
      let settled = false;
      let timeout;

      const finish = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        callback(value);
      };
      const fail = (error) => finish(reject, error);
      const succeed = (paths) => finish(resolve, paths);

      timeout = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // The timeout error below remains the useful response even if the process already ended.
        }
        fail(new AgentDocError(
          "UI_DROP_TARGET_TIMEOUT",
          "The Windows drop box timed out. Try again, or use Browse folder / Browse file."
        ));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        outputBytes += chunk.length;
        if (outputBytes > 512_000) {
          child.kill();
          fail(new AgentDocError("UI_DROP_TARGET_OUTPUT_TOO_LARGE", "Native drop target returned too much data."));
          return;
        }
        stdout.push(chunk);
      });
      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.on("error", (error) => fail(new AgentDocError("UI_DROP_TARGET_FAILED", "Cannot start the native drag-and-drop window.", {
        cause: error instanceof Error ? error.message : String(error)
      })));
      child.on("close", (code) => {
        if (settled) {
          return;
        }
        if (code !== 0) {
          fail(new AgentDocError("UI_DROP_TARGET_FAILED", "Native drag-and-drop window did not complete successfully.", {
            cause: Buffer.concat(stderr).toString("utf8").trim() || `PowerShell exited with code ${code}.`
          }));
          return;
        }

        try {
          const paths = Buffer.concat(stdout).toString("utf8")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => Buffer.from(line, "base64").toString("utf8"));
          succeed(paths);
        } catch (error) {
          fail(new AgentDocError("UI_DROP_TARGET_OUTPUT_INVALID", "Native drop target returned invalid path data.", {
            cause: error instanceof Error ? error.message : String(error)
          }));
        }
      });
    });

    state.promise = processPromise.finally(() => {
      if (active === state) {
        active = null;
      }
    });
    active = state;
    return state.promise;
  };

  const stop = () => {
    if (active?.child && !active.child.killed) {
      active.child.kill();
    }
  };

  return { show, stop };
}

async function serveStatic(response, route) {
  const entry = STATIC_FILES.get(route);
  if (!entry) {
    sendJson(response, 404, { schemaVersion: "1.0", ok: false, error: { code: "UI_NOT_FOUND", message: "Not found." } });
    return;
  }
  const content = await fs.readFile(path.join(UI_DIRECTORY, entry.file));
  response.writeHead(200, securityHeaders(entry.type));
  response.end(content);
}

function parseCliArguments(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function launchBrowser(url) {
  let command;
  let args;
  if (process.platform === "win32") {
    command = "explorer.exe";
    args = [url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

export async function startUiServer({ configPath = DEFAULT_CONFIG_PATH, port = DEFAULT_PORT } = {}) {
  const resolvedConfigPath = path.resolve(expandPathVariables(configPath));
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const nativeDropTarget = createNativeDropTargetManager();

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? `${LOOPBACK_HOST}:${port}`}`);
      const route = requestUrl.pathname;

      if (route === "/bootstrap.js" && request.method === "GET") {
        const bootstrap = `window.AGENT_DOC_UI = ${JSON.stringify({
          token: sessionToken,
          configPath: resolvedConfigPath,
          nativePickers: process.platform === "win32"
        })};\n`;
        response.writeHead(200, securityHeaders("text/javascript; charset=utf-8"));
        response.end(bootstrap);
        return;
      }

      if (!route.startsWith("/api/")) {
        if (request.method !== "GET") {
          sendJson(response, 405, { schemaVersion: "1.0", ok: false, error: { code: "UI_METHOD_NOT_ALLOWED", message: "Method not allowed." } });
          return;
        }
        await serveStatic(response, route);
        return;
      }

      if (!validToken(request, sessionToken)) {
        sendJson(response, 403, { schemaVersion: "1.0", ok: false, error: { code: "UI_FORBIDDEN", message: "Invalid UI session token." } });
        return;
      }

      if (route === "/api/config" && request.method === "GET") {
        const config = await readRawConfig(resolvedConfigPath);
        const check = await checkConfiguration({ configPath: resolvedConfigPath });
        sendJson(response, 200, { schemaVersion: "1.0", ok: true, configPath: resolvedConfigPath, config, check });
        return;
      }

      if (route === "/api/config" && request.method === "POST") {
        const body = await readJsonBody(request);
        if (!body || typeof body !== "object" || !body.config || typeof body.config !== "object" || Array.isArray(body.config)) {
          throw new AgentDocError("UI_CONFIG_REQUIRED", "Request body must contain a config object.");
        }
        const writeResult = await writeValidatedConfig(resolvedConfigPath, body.config);
        const check = await checkConfiguration({ configPath: resolvedConfigPath });
        sendJson(response, 200, { schemaVersion: "1.0", ok: true, configPath: resolvedConfigPath, ...writeResult, check });
        return;
      }

      if (route === "/api/check" && request.method === "POST") {
        await readJsonBody(request);
        sendJson(response, 200, await checkConfiguration({ configPath: resolvedConfigPath }));
        return;
      }

      if (route === "/api/validate-paths" && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await validateUiPaths(body?.entries, { configPath: resolvedConfigPath }));
        return;
      }

      if (route === "/api/search" && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await searchDocuments({
          query: typeof body?.query === "string" ? body.query : "",
          source: typeof body?.source === "string" ? body.source : "local",
          maxResults: body?.maxResults,
          directories: body?.directories,
          files: body?.files
        }, { configPath: resolvedConfigPath }));
        return;
      }

      if (route === "/api/find-tool" && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await findTools({
          query: typeof body?.query === "string" ? body.query : "",
          maxResults: 20
        }, { configPath: resolvedConfigPath }));
        return;
      }

      if (route === "/api/find-prompt" && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await findPrompts({
          query: typeof body?.query === "string" ? body.query : "",
          maxResults: 20
        }, { configPath: resolvedConfigPath }));
        return;
      }

      if (route === "/api/find-secret" && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await findSecrets({
          query: typeof body?.query === "string" ? body.query : "",
          maxResults: 20
        }, { configPath: resolvedConfigPath }));
        return;
      }

      if (route === "/api/inspect-secret" && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await inspectSecretPath({
          name: typeof body?.name === "string" ? body.name : "",
          path: typeof body?.path === "string" ? body.path : "",
          format: typeof body?.format === "string" ? body.format : "auto"
        }));
        return;
      }

      if (route === "/api/pick" && request.method === "POST") {
        const body = await readJsonBody(request);
        const selectedPath = await showNativePicker(body?.kind);
        sendJson(response, 200, { schemaVersion: "1.0", ok: true, cancelled: selectedPath.length === 0, path: selectedPath || null });
        return;
      }

      if (route === "/api/classify-dropped-paths" && request.method === "POST") {
        const body = await readJsonBody(request);
        const classified = await classifyDroppedPaths(body?.paths);
        sendJson(response, 200, { schemaVersion: "1.0", ok: true, ...classified });
        return;
      }

      if (route === "/api/native-drop" && request.method === "POST") {
        await readJsonBody(request);
        const droppedPaths = await nativeDropTarget.show();
        const classified = await classifyDroppedPaths(droppedPaths);
        sendJson(response, 200, {
          schemaVersion: "1.0",
          ok: true,
          cancelled: droppedPaths.length === 0,
          ...classified
        });
        return;
      }

      sendJson(response, 404, { schemaVersion: "1.0", ok: false, error: { code: "UI_NOT_FOUND", message: "Not found." } });
    } catch (error) {
      sendError(response, error);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOOPBACK_HOST, resolve);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    configPath: resolvedConfigPath,
    host: LOOPBACK_HOST,
    port: actualPort,
    token: sessionToken,
    url: `http://${LOOPBACK_HOST}:${actualPort}/`,
    close: () => {
      nativeDropTarget.stop();
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

async function main() {
  const args = parseCliArguments(process.argv.slice(2));
  const port = args.port === undefined ? DEFAULT_PORT : Number(args.port);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new AgentDocError("UI_PORT_INVALID", "--port must be an integer between 0 and 65535.");
  }

  const instance = await startUiServer({
    configPath: typeof args.config === "string" ? args.config : DEFAULT_CONFIG_PATH,
    port
  });
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "1.0",
    ok: true,
    url: instance.url,
    configPath: instance.configPath,
    loopbackOnly: true
  }, null, 2)}\n`);

  if (args["no-open"] !== true) {
    launchBrowser(instance.url);
  }

  const stop = async () => {
    await instance.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify(errorPayload(error), null, 2)}\n`);
    process.exitCode = 1;
  });
}
