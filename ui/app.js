const runtime = window.AGENT_DOC_UI;

if (!runtime?.token) {
  throw new Error("The configuration UI did not receive a local session token.");
}

const elements = {
  configPath: document.querySelector("#config-path"),
  pageStatus: document.querySelector("#page-status"),
  documentsTab: document.querySelector("#documents-tab"),
  toolsTab: document.querySelector("#tools-tab"),
  documentsPanel: document.querySelector("#documents-panel"),
  toolsPanel: document.querySelector("#tools-panel"),
  rootsList: document.querySelector("#roots-list"),
  rootsEmpty: document.querySelector("#roots-empty"),
  filesList: document.querySelector("#files-list"),
  filesEmpty: document.querySelector("#files-empty"),
  rootTemplate: document.querySelector("#root-row-template"),
  fileTemplate: document.querySelector("#file-row-template"),
  dropZone: document.querySelector("#drop-zone"),
  dropHelp: document.querySelector("#drop-help"),
  openDropBox: document.querySelector("#open-drop-box"),
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
  toolDirectoriesList: document.querySelector("#tool-directories-list"),
  toolDirectoriesEmpty: document.querySelector("#tool-directories-empty"),
  toolFilesList: document.querySelector("#tool-files-list"),
  toolFilesEmpty: document.querySelector("#tool-files-empty"),
  toolDirectoryTemplate: document.querySelector("#tool-directory-row-template"),
  toolFileTemplate: document.querySelector("#tool-file-row-template"),
  toolDropZone: document.querySelector("#tool-drop-zone"),
  toolDropHelp: document.querySelector("#tool-drop-help"),
  toolOpenDropBox: document.querySelector("#tool-open-drop-box"),
  addToolFolder: document.querySelector("#add-tool-folder"),
  pickToolFolder: document.querySelector("#pick-tool-folder"),
  addToolFile: document.querySelector("#add-tool-file"),
  pickToolFile: document.querySelector("#pick-tool-file"),
  toolExtensions: document.querySelector("#tool-extensions"),
  toolSearchForm: document.querySelector("#tool-search-form"),
  toolSearchQuery: document.querySelector("#tool-search-query"),
  runToolSearch: document.querySelector("#run-tool-search"),
  toolSearchSummary: document.querySelector("#tool-search-summary"),
  toolSearchResults: document.querySelector("#tool-search-results"),
  toast: document.querySelector("#toast")
};

const state = {
  config: null,
  check: null,
  sourceKey: "local",
  activeTab: "documents",
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

function comparableLocalPath(value) {
  const normalized = value.trim().replaceAll("/", "\\").replace(/[\\]+$/, "");
  return runtime.nativePickers ? normalized.toLowerCase() : normalized;
}

function uniqueNameInList(list, baseName) {
  const existing = new Set([...list.querySelectorAll('[data-field="name"]')]
    .map((input) => input.value.trim().toLowerCase()));
  if (!existing.has(baseName.toLowerCase())) {
    return baseName;
  }
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${baseName}-${suffix}`;
    if (!existing.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return `${baseName}-${Date.now()}`;
}

function uniqueRootName(baseName) {
  return uniqueNameInList(elements.rootsList, baseName);
}

function uniqueToolDirectoryName(baseName) {
  return uniqueNameInList(elements.toolDirectoriesList, baseName);
}

function uniqueToolFileName(baseName) {
  return uniqueNameInList(elements.toolFilesList, baseName);
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

function appendToolDirectory(directory = {}, availability = undefined) {
  const fragment = elements.toolDirectoryTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const priorityInput = row.querySelector('[data-field="priority"]');
  const recursiveInput = row.querySelector('[data-field="recursive"]');
  const includeDocsInput = row.querySelector('[data-field="includeDocs"]');
  const pathState = row.querySelector('[data-role="state"]');

  const normalized = typeof directory === "string"
    ? { path: directory, priority: 0, recursive: true, includeDocs: true }
    : directory;
  nameInput.value = normalized.name ?? friendlyPathName(normalized.path ?? "", "tool-folder");
  pathInput.value = normalized.path ?? "";
  priorityInput.value = normalized.priority ?? 0;
  recursiveInput.checked = normalized.recursive !== false;
  includeDocsInput.checked = normalized.includeDocs !== false;
  if (availability && availability.available === false) {
    pathState.textContent = availability.error ? "Unavailable" : "Not a regular folder";
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

  elements.toolDirectoriesList.append(row);
  updateEmptyStates();
  return row;
}

function appendToolFile(toolFile = {}, availability = undefined) {
  const fragment = elements.toolFileTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const priorityInput = row.querySelector('[data-field="priority"]');
  const pathState = row.querySelector('[data-role="state"]');

  const normalized = typeof toolFile === "string" ? { path: toolFile, priority: 0 } : toolFile;
  nameInput.value = normalized.name ?? friendlyPathName(normalized.path ?? "", "tool-file");
  pathInput.value = normalized.path ?? "";
  priorityInput.value = normalized.priority ?? 0;
  if (availability && availability.available === false) {
    pathState.textContent = availability.error ? "Unavailable" : "Not a regular file";
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

  elements.toolFilesList.append(row);
  updateEmptyStates();
  return row;
}

function updateEmptyStates() {
  elements.rootsEmpty.hidden = elements.rootsList.children.length > 0;
  elements.filesEmpty.hidden = elements.filesList.children.length > 0;
  elements.toolDirectoriesEmpty.hidden = elements.toolDirectoriesList.children.length > 0;
  elements.toolFilesEmpty.hidden = elements.toolFilesList.children.length > 0;
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
  const tools = config.tools ?? {
    directories: [],
    files: [],
    extensions: [".exe", ".com", ".cmd", ".bat", ".ps1", ".py", ".js", ".mjs", ".cjs"]
  };
  const checkedTools = check?.tools;

  elements.rootsList.replaceChildren();
  elements.filesList.replaceChildren();
  elements.toolDirectoriesList.replaceChildren();
  elements.toolFilesList.replaceChildren();
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
  for (const [index, directory] of (tools.directories ?? []).entries()) {
    const directoryName = typeof directory === "string" ? `tool-directory-${index + 1}` : directory.name;
    const availability = checkedTools?.directories?.find((entry) => entry.name === directoryName)
      ?? checkedTools?.directories?.[index];
    appendToolDirectory(directory, availability);
  }
  for (const [index, toolFile] of (tools.files ?? []).entries()) {
    const toolName = typeof toolFile === "string" ? undefined : toolFile.name;
    const availability = toolName
      ? checkedTools?.files?.find((entry) => entry.name === toolName)
      : checkedTools?.files?.[index];
    appendToolFile(toolFile, availability);
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
  elements.toolExtensions.value = extensionText(tools.extensions);

  const unavailableRoots = checkedSource?.roots?.filter((entry) => !entry.available).length ?? 0;
  const unavailableFiles = checkedSource?.files?.filter((entry) => !entry.available).length ?? 0;
  const unavailableToolDirectories = checkedTools?.directories?.filter((entry) => !entry.available).length ?? 0;
  const unavailableToolFiles = checkedTools?.files?.filter((entry) => !entry.available).length ?? 0;
  const unavailableTotal = unavailableRoots + unavailableFiles + unavailableToolDirectories + unavailableToolFiles;
  if (unavailableTotal > 0) {
    setPageStatus("warning", "Configuration loaded with unavailable paths", `${unavailableTotal} document or tool path(s) need attention.`);
  } else {
    setPageStatus(
      "ready",
      "Configuration is valid",
      `${source.roots?.length ?? 0} document folder(s), ${source.files?.length ?? 0} exact document(s), ${tools.directories?.length ?? 0} tool folder(s), and ${tools.files?.length ?? 0} exact tool(s) are allowed.`
    );
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

  next.tools = {
    directories: [...elements.toolDirectoriesList.querySelectorAll(".entry-row")].map((row, index) => {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const folderPath = row.querySelector('[data-field="path"]').value.trim();
      const priority = Number(row.querySelector('[data-field="priority"]').value);
      if (!name || !folderPath || !Number.isInteger(priority)) {
        throw new Error(`Tool folder ${index + 1} needs a name, path, and integer priority.`);
      }
      return {
        name,
        path: folderPath,
        priority,
        recursive: row.querySelector('[data-field="recursive"]').checked,
        includeDocs: row.querySelector('[data-field="includeDocs"]').checked
      };
    }),
    files: [...elements.toolFilesList.querySelectorAll(".entry-row")].map((row, index) => {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const filePath = row.querySelector('[data-field="path"]').value.trim();
      const priority = Number(row.querySelector('[data-field="priority"]').value);
      if (!name || !filePath || !Number.isInteger(priority)) {
        throw new Error(`Exact tool ${index + 1} needs a name, path, and integer priority.`);
      }
      return { name, path: filePath, priority };
    }),
    extensions: elements.toolExtensions.value.trim() || []
  };

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

async function pickPath(kind, target = "documents") {
  const button = target === "tools"
    ? (kind === "directory" ? elements.pickToolFolder : elements.pickToolFile)
    : (kind === "directory" ? elements.pickFolder : elements.pickFile);
  setBusy(button, true, "Waiting for picker…");
  try {
    const payload = await api("/api/pick", { method: "POST", body: { kind } });
    if (payload.cancelled) {
      return;
    }
    if (target === "tools" && kind === "directory") {
      const row = appendToolDirectory({
        name: uniqueToolDirectoryName(friendlyPathName(payload.path, "tool-folder")),
        path: payload.path,
        priority: 100,
        recursive: true,
        includeDocs: true
      });
      row.querySelector('[data-field="name"]').focus();
    } else if (target === "tools") {
      const row = appendToolFile({
        name: uniqueToolFileName(friendlyPathName(payload.path, "tool-file")),
        path: payload.path,
        priority: 100
      });
      row.querySelector('[data-field="name"]').focus();
    } else if (kind === "directory") {
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

function addDroppedItems(items, errors = []) {
  const existingFolders = new Set([...elements.rootsList.querySelectorAll('[data-field="path"]')]
    .map((input) => comparableLocalPath(input.value)));
  const existingFiles = new Set([...elements.filesList.querySelectorAll('[data-field="path"]')]
    .map((input) => comparableLocalPath(input.value)));
  let added = 0;
  let duplicates = 0;

  for (const item of items) {
    const comparable = comparableLocalPath(item.path);
    if (item.type === "directory") {
      if (existingFolders.has(comparable)) {
        duplicates += 1;
        continue;
      }
      const rootName = uniqueRootName(friendlyPathName(item.path, "allowed-folder"));
      appendRoot({ name: rootName, path: item.path, priority: 100 });
      existingFolders.add(comparable);
      added += 1;
    } else if (item.type === "file") {
      if (existingFiles.has(comparable)) {
        duplicates += 1;
        continue;
      }
      appendFile(item.path);
      existingFiles.add(comparable);
      added += 1;
    }
  }

  if (added > 0) {
    markDirty();
  }
  const details = [
    `${added} item${added === 1 ? "" : "s"} added`,
    ...(duplicates > 0 ? [`${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped`] : []),
    ...(errors.length > 0 ? [`${errors.length} unavailable item${errors.length === 1 ? "" : "s"} skipped`] : [])
  ];
  showToast(`${details.join(" · ")}.${added > 0 ? " Save configuration to apply." : ""}`, added > 0 || duplicates > 0 ? "success" : "error");
}

function addDroppedToolItems(items, errors = []) {
  const existingFolders = new Set([...elements.toolDirectoriesList.querySelectorAll('[data-field="path"]')]
    .map((input) => comparableLocalPath(input.value)));
  const existingFiles = new Set([...elements.toolFilesList.querySelectorAll('[data-field="path"]')]
    .map((input) => comparableLocalPath(input.value)));
  let added = 0;
  let duplicates = 0;

  for (const item of items) {
    const comparable = comparableLocalPath(item.path);
    if (item.type === "directory") {
      if (existingFolders.has(comparable)) {
        duplicates += 1;
        continue;
      }
      const name = uniqueToolDirectoryName(friendlyPathName(item.path, "tool-folder"));
      appendToolDirectory({ name, path: item.path, priority: 100, recursive: true, includeDocs: true });
      existingFolders.add(comparable);
      added += 1;
    } else if (item.type === "file") {
      if (existingFiles.has(comparable)) {
        duplicates += 1;
        continue;
      }
      const name = uniqueToolFileName(friendlyPathName(item.path, "tool-file"));
      appendToolFile({ name, path: item.path, priority: 100 });
      existingFiles.add(comparable);
      added += 1;
    }
  }

  if (added > 0) {
    markDirty();
  }
  const details = [
    `${added} tool item${added === 1 ? "" : "s"} added`,
    ...(duplicates > 0 ? [`${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped`] : []),
    ...(errors.length > 0 ? [`${errors.length} unavailable item${errors.length === 1 ? "" : "s"} skipped`] : [])
  ];
  showToast(`${details.join(" · ")}.${added > 0 ? " Save configuration to apply." : ""}`, added > 0 || duplicates > 0 ? "success" : "error");
}

function fileUrlPath(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "file:") {
      return null;
    }
    let decoded = decodeURIComponent(parsed.pathname);
    if (/^\/[A-Za-z]:\//.test(decoded)) {
      decoded = decoded.slice(1);
    }
    return runtime.nativePickers ? decoded.replaceAll("/", "\\") : decoded;
  } catch {
    return null;
  }
}

function looksLikeAbsolutePath(value) {
  return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value) || (!runtime.nativePickers && value.startsWith("/"));
}

function droppedAbsolutePaths(dataTransfer) {
  const candidates = [];
  for (const file of dataTransfer?.files ?? []) {
    const exposedPath = typeof file.path === "string" ? file.path : typeof file.fullPath === "string" ? file.fullPath : "";
    if (looksLikeAbsolutePath(exposedPath)) {
      candidates.push(exposedPath);
    }
  }

  for (const type of ["text/uri-list", "text/plain"]) {
    const text = dataTransfer?.getData(type) ?? "";
    for (const line of text.split(/\r?\n/).map((entry) => entry.trim()).filter((entry) => entry && !entry.startsWith("#"))) {
      const fromUrl = line.startsWith("file:") ? fileUrlPath(line) : null;
      const candidate = fromUrl ?? line.replace(/^"|"$/g, "");
      if (candidate && looksLikeAbsolutePath(candidate)) {
        candidates.push(candidate);
      }
    }
  }

  return [...new Map(candidates.map((candidate) => [comparableLocalPath(candidate), candidate])).values()];
}

async function classifyAndAddDroppedPaths(paths, target = "documents") {
  const payload = await api("/api/classify-dropped-paths", { method: "POST", body: { paths } });
  if (target === "tools") {
    addDroppedToolItems(payload.items, payload.errors);
  } else {
    addDroppedItems(payload.items, payload.errors);
  }
}

async function openNativeDropBox(target = "documents") {
  const button = target === "tools" ? elements.toolOpenDropBox : elements.openDropBox;
  setBusy(button, true, "Use the open drop box…");
  try {
    const payload = await api("/api/native-drop", { method: "POST", body: {} });
    if (!payload.cancelled) {
      if (target === "tools") {
        addDroppedToolItems(payload.items, payload.errors);
      } else {
        addDroppedItems(payload.items, payload.errors);
      }
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

async function handleBrowserDrop(event, target = "documents") {
  event.preventDefault();
  const dropZone = target === "tools" ? elements.toolDropZone : elements.dropZone;
  dropZone.classList.remove("is-dragging");
  const paths = droppedAbsolutePaths(event.dataTransfer);
  if (paths.length > 0) {
    try {
      await classifyAndAddDroppedPaths(paths, target);
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }

  if (runtime.nativePickers) {
    showToast("A separate Windows drop box is opening in front. Drop the same items there, or press Esc to cancel.");
    await openNativeDropBox(target);
  } else {
    showToast("This browser does not expose complete local paths. Use the folder or file browse buttons.", "error");
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

function invocationText(invocation) {
  return [invocation.command, ...(invocation.argumentsPrefix ?? [])]
    .map((part) => /\s/.test(part) ? JSON.stringify(part) : part)
    .join(" ");
}

async function runToolSearch(event) {
  event.preventDefault();
  if (state.dirty) {
    showToast("Save your configuration before testing the tool catalog.", "error");
    return;
  }

  setBusy(elements.runToolSearch, true, "Resolving…");
  elements.toolSearchSummary.hidden = true;
  elements.toolSearchResults.replaceChildren();
  try {
    const payload = await api("/api/find-tool", {
      method: "POST",
      body: { query: elements.toolSearchQuery.value.trim() }
    });
    elements.toolSearchSummary.hidden = false;
    elements.toolSearchSummary.textContent = `${payload.results.length} result(s) · ${payload.meta.eligibleFiles} eligible file(s) · ${payload.meta.elapsedMs} ms · nothing executed`;

    if (payload.results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching executable or script was found in the allowed tool catalog.";
      elements.toolSearchResults.append(empty);
      return;
    }

    for (const result of payload.results) {
      const article = document.createElement("article");
      article.className = "result tool-result";
      const badge = document.createElement("div");
      badge.className = "result-line tool-type";
      badge.textContent = result.type.replace(/-script$/, "").replace("executable", "exe");
      const body = document.createElement("div");
      const heading = document.createElement("strong");
      heading.className = "result-name";
      heading.textContent = result.name;
      const resultPath = document.createElement("div");
      resultPath.className = "result-path";
      resultPath.textContent = result.path;
      const resultText = document.createElement("div");
      resultText.className = "result-text";
      const docs = result.documentationSearchEnabled ? " · documentation searchable" : "";
      resultText.textContent = `Invocation template: ${invocationText(result.invocation)} · ${result.sourceName}${docs}`;
      body.append(heading, resultPath, resultText);
      article.append(badge, body);
      elements.toolSearchResults.append(article);
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(elements.runToolSearch, false);
  }
}

function activateTab(tabName, focus = false) {
  const toolsActive = tabName === "tools";
  state.activeTab = toolsActive ? "tools" : "documents";
  elements.documentsTab.classList.toggle("is-active", !toolsActive);
  elements.toolsTab.classList.toggle("is-active", toolsActive);
  elements.documentsTab.setAttribute("aria-selected", String(!toolsActive));
  elements.toolsTab.setAttribute("aria-selected", String(toolsActive));
  elements.documentsTab.tabIndex = toolsActive ? -1 : 0;
  elements.toolsTab.tabIndex = toolsActive ? 0 : -1;
  elements.documentsPanel.hidden = toolsActive;
  elements.toolsPanel.hidden = !toolsActive;
  if (focus) {
    (toolsActive ? elements.toolsTab : elements.documentsTab).focus();
  }
}

function wireDropZone(dropZone, target) {
  dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  });
  dropZone.addEventListener("dragleave", (event) => {
    if (!dropZone.contains(event.relatedTarget)) {
      dropZone.classList.remove("is-dragging");
    }
  });
  dropZone.addEventListener("drop", (event) => handleBrowserDrop(event, target));
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
  elements.maxFileBytes,
  elements.toolExtensions
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
elements.addToolFolder.addEventListener("click", () => {
  const name = uniqueToolDirectoryName(`tool-folder-${elements.toolDirectoriesList.children.length + 1}`);
  const row = appendToolDirectory({ name, path: "", priority: 100, recursive: true, includeDocs: true });
  row.querySelector('[data-field="path"]').focus();
  markDirty();
});
elements.addToolFile.addEventListener("click", () => {
  const name = uniqueToolFileName(`tool-file-${elements.toolFilesList.children.length + 1}`);
  const row = appendToolFile({ name, path: "", priority: 100 });
  row.querySelector('[data-field="path"]').focus();
  markDirty();
});
elements.pickFolder.addEventListener("click", () => pickPath("directory"));
elements.pickFile.addEventListener("click", () => pickPath("file"));
elements.pickToolFolder.addEventListener("click", () => pickPath("directory", "tools"));
elements.pickToolFile.addEventListener("click", () => pickPath("file", "tools"));
elements.openDropBox.addEventListener("click", () => openNativeDropBox("documents"));
elements.toolOpenDropBox.addEventListener("click", () => openNativeDropBox("tools"));
wireDropZone(elements.dropZone, "documents");
wireDropZone(elements.toolDropZone, "tools");
elements.reloadConfig.addEventListener("click", () => {
  if (!state.dirty || window.confirm("Discard unsaved changes and reload the saved configuration?")) {
    loadConfig();
  }
});
elements.saveConfig.addEventListener("click", saveConfig);
elements.searchForm.addEventListener("submit", runSearch);
elements.toolSearchForm.addEventListener("submit", runToolSearch);
elements.documentsTab.addEventListener("click", () => activateTab("documents"));
elements.toolsTab.addEventListener("click", () => activateTab("tools"));
for (const tab of [elements.documentsTab, elements.toolsTab]) {
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextTab = event.key === "ArrowRight" || event.key === "End" ? "tools" : "documents";
    activateTab(nextTab, true);
  });
}

if (!runtime.nativePickers) {
  elements.pickFolder.hidden = true;
  elements.pickFile.hidden = true;
  elements.openDropBox.hidden = true;
  elements.pickToolFolder.hidden = true;
  elements.pickToolFile.hidden = true;
  elements.toolOpenDropBox.hidden = true;
  elements.dropHelp.textContent = "Drop files or folders directly when your browser exposes complete local paths.";
  elements.toolDropHelp.textContent = "Drop tool folders or files directly when your browser exposes complete local paths.";
}

window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
  }
});

elements.configPath.textContent = runtime.configPath;
activateTab("documents");
loadConfig();
