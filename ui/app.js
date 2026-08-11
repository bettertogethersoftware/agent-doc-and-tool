const runtime = window.AGENT_DOC_UI;

if (!runtime?.token) {
  throw new Error("The configuration UI did not receive a local session token.");
}

const elements = {
  configPath: document.querySelector("#config-path"),
  pageStatus: document.querySelector("#page-status"),
  rootsList: document.querySelector("#roots-list"),
  rootsEmpty: document.querySelector("#roots-empty"),
  filesList: document.querySelector("#files-list"),
  filesEmpty: document.querySelector("#files-empty"),
  rootTemplate: document.querySelector("#root-row-template"),
  fileTemplate: document.querySelector("#file-row-template"),
  addFolder: document.querySelector("#add-folder"),
  pickFolder: document.querySelector("#pick-folder"),
  addFile: document.querySelector("#add-file"),
  pickFile: document.querySelector("#pick-file"),
  extensions: document.querySelector("#extensions"),
  fileNames: document.querySelector("#file-names"),
  caseSensitive: document.querySelector("#case-sensitive"),
  ignoreFile: document.querySelector("#ignore-file"),
  ignorePatterns: document.querySelector("#ignore-patterns"),
  maxResults: document.querySelector("#max-results"),
  maxFiles: document.querySelector("#max-files"),
  timeoutMs: document.querySelector("#timeout-ms"),
  maxLineChars: document.querySelector("#max-line-chars"),
  maxFileBytes: document.querySelector("#max-file-bytes"),
  reloadConfig: document.querySelector("#reload-config"),
  saveConfig: document.querySelector("#save-config"),
  dirtyState: document.querySelector("#dirty-state"),
  searchForm: document.querySelector("#search-form"),
  searchQuery: document.querySelector("#search-query"),
  runSearch: document.querySelector("#run-search"),
  searchSummary: document.querySelector("#search-summary"),
  searchResults: document.querySelector("#search-results"),
  toast: document.querySelector("#toast")
};

const state = {
  config: null,
  check: null,
  sourceKey: "local",
  dirty: false,
  toastTimer: null
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function splitValues(value) {
  return value
    .split(/[;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitLines(value) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extensionText(value) {
  return Array.isArray(value) ? value.join(";") : (value ?? "");
}

function setBusy(button, busy, busyLabel) {
  if (busy) {
    button.dataset.previousLabel = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.previousLabel) {
    button.textContent = button.dataset.previousLabel;
    delete button.dataset.previousLabel;
  }
  button.disabled = busy;
}

function showToast(message, kind = "success") {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", kind === "error");
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 5_000);
}

function setPageStatus(kind, title, description) {
  elements.pageStatus.className = `notice is-${kind}`;
  elements.pageStatus.querySelector(".notice-icon").textContent = kind === "error" ? "!" : kind === "warning" ? "△" : "✓";
  elements.pageStatus.querySelector("strong").textContent = title;
  elements.pageStatus.querySelector("p").textContent = description;
}

function markDirty() {
  if (!state.config) {
    return;
  }
  state.dirty = true;
  elements.dirtyState.textContent = "Unsaved changes";
  elements.saveConfig.disabled = false;
}

function markClean() {
  state.dirty = false;
  elements.dirtyState.textContent = "No unsaved changes";
  elements.saveConfig.disabled = false;
}

async function api(route, { method = "GET", body } = {}) {
  const response = await fetch(route, {
    method,
    headers: {
      "x-agent-doc-token": runtime.token,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.error?.message ?? `Request failed with status ${response.status}.`);
    error.code = payload.error?.code;
    error.details = payload.error?.details;
    throw error;
  }
  return payload;
}

function friendlyPathName(filePath, fallback) {
  const name = filePath.split(/[\\/]/).filter(Boolean).at(-1) ?? fallback;
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || fallback;
}

function attachConfigurationInput(input) {
  input.addEventListener("input", markDirty);
  input.addEventListener("change", markDirty);
}

function appendRoot(root = {}, availability = undefined) {
  const fragment = elements.rootTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const priorityInput = row.querySelector('[data-field="priority"]');
  const pathState = row.querySelector('[data-role="state"]');

  const normalized = typeof root === "string" ? { path: root, priority: 0 } : root;
  nameInput.value = normalized.name ?? friendlyPathName(normalized.path ?? "", "allowed-folder");
  pathInput.value = normalized.path ?? "";
  priorityInput.value = normalized.priority ?? 0;
  if (availability && availability.available === false) {
    pathState.textContent = availability.error ? "Unavailable" : "Not a directory";
    pathState.classList.add("is-missing");
  }

  for (const input of row.querySelectorAll("input")) {
    attachConfigurationInput(input);
  }
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    row.remove();
    updateEmptyStates();
    markDirty();
  });

  elements.rootsList.append(row);
  updateEmptyStates();
  return row;
}

function appendFile(filePath = "", availability = undefined) {
  const fragment = elements.fileTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const pathInput = row.querySelector('[data-field="path"]');
  const pathState = row.querySelector('[data-role="state"]');
  pathInput.value = filePath;
  if (availability && availability.available === false) {
    pathState.textContent = availability.error ? "Unavailable" : "Not a regular file";
    pathState.classList.add("is-missing");
  }

  attachConfigurationInput(pathInput);
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    row.remove();
    updateEmptyStates();
    markDirty();
  });

  elements.filesList.append(row);
  updateEmptyStates();
  return row;
}

function updateEmptyStates() {
  elements.rootsEmpty.hidden = elements.rootsList.children.length > 0;
  elements.filesEmpty.hidden = elements.filesList.children.length > 0;
}

function configuredSource(config) {
  const requested = config.defaultSource ?? "local";
  const matchingKey = Object.keys(config.sources ?? {}).find((key) => key.toLowerCase() === requested.toLowerCase());
  if (!matchingKey) {
    throw new Error(`Default source '${requested}' is not present in the configuration.`);
  }
  state.sourceKey = matchingKey;
  return config.sources[matchingKey];
}

function renderConfig(config, check) {
  const source = configuredSource(config);
  const checkedSource = check?.sources?.[state.sourceKey.toLowerCase()];

  elements.rootsList.replaceChildren();
  elements.filesList.replaceChildren();
  for (const root of (source.roots ?? [])) {
    const rootName = typeof root === "string" ? undefined : root.name;
    const availability = rootName
      ? checkedSource?.roots?.find((entry) => entry.name === rootName)
      : undefined;
    appendRoot(root, availability);
  }
  for (const [index, filePath] of (source.files ?? []).entries()) {
    appendFile(filePath, checkedSource?.files?.[index]);
  }

  elements.extensions.value = extensionText(source.extensions);
  elements.fileNames.value = (source.fileNames ?? []).join(";");
  elements.caseSensitive.checked = config.caseSensitive === true;
  elements.ignoreFile.value = config.ignoreFile ?? "";
  elements.ignorePatterns.value = (config.ignore ?? []).join("\n");
  elements.maxResults.value = config.limits?.maxResults ?? 50;
  elements.maxFiles.value = config.limits?.maxFiles ?? 50_000;
  elements.timeoutMs.value = config.limits?.timeoutMs ?? 15_000;
  elements.maxLineChars.value = config.limits?.maxLineChars ?? 1_000;
  elements.maxFileBytes.value = config.limits?.maxFileBytes ?? 2_000_000;

  const unavailableRoots = checkedSource?.roots?.filter((entry) => !entry.available).length ?? 0;
  const unavailableFiles = checkedSource?.files?.filter((entry) => !entry.available).length ?? 0;
  if (unavailableRoots + unavailableFiles > 0) {
    setPageStatus("warning", "Configuration loaded with unavailable paths", `${unavailableRoots} folder(s) and ${unavailableFiles} exact file(s) need attention.`);
  } else {
    setPageStatus("ready", "Configuration is valid", `${source.roots?.length ?? 0} folder(s) and ${source.files?.length ?? 0} exact file(s) are currently allowed.`);
  }
  updateEmptyStates();
  markClean();
}

function positiveInteger(input, label) {
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < Number(input.min) || value > Number(input.max)) {
    throw new Error(`${label} must be an integer from ${input.min} to ${input.max}.`);
  }
  return value;
}

function collectConfig() {
  const next = deepClone(state.config);
  const source = next.sources[state.sourceKey];

  source.roots = [...elements.rootsList.querySelectorAll(".entry-row")].map((row, index) => {
    const name = row.querySelector('[data-field="name"]').value.trim();
    const folderPath = row.querySelector('[data-field="path"]').value.trim();
    const priority = Number(row.querySelector('[data-field="priority"]').value);
    if (!name || !folderPath || !Number.isInteger(priority)) {
      throw new Error(`Allowed folder ${index + 1} needs a name, path, and integer priority.`);
    }
    return { name, path: folderPath, priority };
  });

  source.files = [...elements.filesList.querySelectorAll(".entry-row")].map((row, index) => {
    const filePath = row.querySelector('[data-field="path"]').value.trim();
    if (!filePath) {
      throw new Error(`Exact file ${index + 1} needs a path.`);
    }
    return filePath;
  });

  const patterns = elements.extensions.value.trim();
  source.extensions = patterns || [];
  source.fileNames = splitValues(elements.fileNames.value);
  next.caseSensitive = elements.caseSensitive.checked;
  const ignoreFile = elements.ignoreFile.value.trim();
  if (ignoreFile) {
    next.ignoreFile = ignoreFile;
  } else {
    delete next.ignoreFile;
  }
  next.ignore = splitLines(elements.ignorePatterns.value);
  next.limits.maxResults = positiveInteger(elements.maxResults, "Max results");
  next.limits.maxFiles = positiveInteger(elements.maxFiles, "Max files");
  next.limits.timeoutMs = positiveInteger(elements.timeoutMs, "Timeout");
  next.limits.maxLineChars = positiveInteger(elements.maxLineChars, "Max line characters");
  next.limits.maxFileBytes = positiveInteger(elements.maxFileBytes, "Max file bytes");
  return next;
}

async function loadConfig() {
  setBusy(elements.reloadConfig, true, "Loading…");
  try {
    const payload = await api("/api/config");
    state.config = payload.config;
    state.check = payload.check;
    elements.configPath.textContent = payload.configPath;
    elements.configPath.title = payload.configPath;
    renderConfig(payload.config, payload.check);
  } catch (error) {
    setPageStatus("error", "Could not load configuration", error.message);
    showToast(error.message, "error");
  } finally {
    setBusy(elements.reloadConfig, false);
  }
}

async function saveConfig() {
  setBusy(elements.saveConfig, true, "Validating and saving…");
  try {
    const config = collectConfig();
    const payload = await api("/api/config", { method: "POST", body: { config } });
    state.config = config;
    state.check = payload.check;
    renderConfig(config, payload.check);
    showToast(payload.backupCreated ? `Saved. Previous configuration backed up to ${payload.backupPath}` : "Configuration saved.");
  } catch (error) {
    setPageStatus("error", "Configuration was not saved", error.message);
    showToast(error.message, "error");
  } finally {
    setBusy(elements.saveConfig, false);
  }
}

async function pickPath(kind) {
  const button = kind === "directory" ? elements.pickFolder : elements.pickFile;
  setBusy(button, true, "Waiting for picker…");
  try {
    const payload = await api("/api/pick", { method: "POST", body: { kind } });
    if (payload.cancelled) {
      return;
    }
    if (kind === "directory") {
      const row = appendRoot({ name: friendlyPathName(payload.path, "allowed-folder"), path: payload.path, priority: 100 });
      row.querySelector('[data-field="name"]').focus();
    } else {
      const row = appendFile(payload.path);
      row.querySelector('[data-field="path"]').focus();
    }
    markDirty();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

async function runSearch(event) {
  event.preventDefault();
  if (state.dirty) {
    showToast("Save your configuration before running a test search.", "error");
    return;
  }

  setBusy(elements.runSearch, true, "Searching…");
  elements.searchSummary.hidden = true;
  elements.searchResults.replaceChildren();
  try {
    const payload = await api("/api/search", {
      method: "POST",
      body: { query: elements.searchQuery.value.trim(), source: state.sourceKey }
    });
    elements.searchSummary.hidden = false;
    elements.searchSummary.textContent = `${payload.results.length} result(s) · ${payload.meta.filesRead} file(s) read · ${payload.meta.elapsedMs} ms${payload.meta.truncated ? " · partial result" : ""}`;

    if (payload.results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching line was found in the allowed documents.";
      elements.searchResults.append(empty);
      return;
    }

    for (const result of payload.results) {
      const article = document.createElement("article");
      article.className = "result";
      const line = document.createElement("div");
      line.className = "result-line";
      line.textContent = `L${result.lineNumber}`;
      const body = document.createElement("div");
      const resultPath = document.createElement("div");
      resultPath.className = "result-path";
      resultPath.textContent = result.path;
      const resultText = document.createElement("div");
      resultText.className = "result-text";
      resultText.textContent = result.lineText;
      body.append(resultPath, resultText);
      article.append(line, body);
      elements.searchResults.append(article);
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(elements.runSearch, false);
  }
}

for (const input of [
  elements.extensions,
  elements.fileNames,
  elements.caseSensitive,
  elements.ignoreFile,
  elements.ignorePatterns,
  elements.maxResults,
  elements.maxFiles,
  elements.timeoutMs,
  elements.maxLineChars,
  elements.maxFileBytes
]) {
  attachConfigurationInput(input);
}

elements.addFolder.addEventListener("click", () => {
  const row = appendRoot({ name: `allowed-folder-${elements.rootsList.children.length + 1}`, path: "", priority: 100 });
  row.querySelector('[data-field="path"]').focus();
  markDirty();
});
elements.addFile.addEventListener("click", () => {
  const row = appendFile();
  row.querySelector('[data-field="path"]').focus();
  markDirty();
});
elements.pickFolder.addEventListener("click", () => pickPath("directory"));
elements.pickFile.addEventListener("click", () => pickPath("file"));
elements.reloadConfig.addEventListener("click", () => {
  if (!state.dirty || window.confirm("Discard unsaved changes and reload the saved configuration?")) {
    loadConfig();
  }
});
elements.saveConfig.addEventListener("click", saveConfig);
elements.searchForm.addEventListener("submit", runSearch);

if (!runtime.nativePickers) {
  elements.pickFolder.hidden = true;
  elements.pickFile.hidden = true;
}

window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
  }
});

elements.configPath.textContent = runtime.configPath;
loadConfig();
