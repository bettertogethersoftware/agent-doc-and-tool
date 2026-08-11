#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DEFAULT_CONFIG_PATH, expandPathVariables, parseConfig, PROJECT_ROOT } from "./config.mjs";
import { AgentDocError, errorPayload } from "./errors.mjs";
import { checkConfiguration, searchDocuments } from "./search-service.mjs";

const UI_DIRECTORY = path.join(PROJECT_ROOT, "ui");
const MAX_REQUEST_BYTES = 1_000_000;
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

function pickerScript(kind) {
  const common = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8"
  ];

  if (kind === "directory") {
    return [...common,
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "$dialog.Description = 'Choose a folder that the AI may search'",
      "$dialog.ShowNewFolderButton = $false",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }"
    ].join("; ");
  }
  if (kind === "file") {
    return [...common,
      "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
      "$dialog.Title = 'Choose an exact file that the AI may search and fetch'",
      "$dialog.Filter = 'Text and documentation files|*.md;*.json;*.txt;*.yaml;*.yml|All files|*.*'",
      "$dialog.CheckFileExists = $true",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.FileName) }"
    ].join("; ");
  }
  throw new AgentDocError("UI_PICKER_KIND_INVALID", "Picker kind must be 'file' or 'directory'.");
}

async function showNativePicker(kind) {
  if (process.platform !== "win32") {
    throw new AgentDocError("UI_PICKER_UNAVAILABLE", "Native file and folder pickers are currently available on Windows only.");
  }

  const powershell = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return new Promise((resolve, reject) => {
    const child = spawn(powershell, ["-NoLogo", "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", pickerScript(kind)], {
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

      if (route === "/api/search" && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await searchDocuments({
          query: typeof body?.query === "string" ? body.query : "",
          source: typeof body?.source === "string" ? body.source : "local",
          maxResults: 20
        }, { configPath: resolvedConfigPath }));
        return;
      }

      if (route === "/api/pick" && request.method === "POST") {
        const body = await readJsonBody(request);
        const selectedPath = await showNativePicker(body?.kind);
        sendJson(response, 200, { schemaVersion: "1.0", ok: true, cancelled: selectedPath.length === 0, path: selectedPath || null });
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
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
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
