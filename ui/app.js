const runtime = window.AGENT_DOC_UI;

if (!runtime?.token) {
  throw new Error("The configuration UI did not receive a local session token.");
}

const elements = {
  configPath: document.querySelector("#config-path"),
  pageStatus: document.querySelector("#page-status"),
  documentsTab: document.querySelector("#documents-tab"),
  toolsTab: document.querySelector("#tools-tab"),
  promptsTab: document.querySelector("#prompts-tab"),
  secretsTab: document.querySelector("#secrets-tab"),
  documentsPanel: document.querySelector("#documents-panel"),
  toolsPanel: document.querySelector("#tools-panel"),
  promptsPanel: document.querySelector("#prompts-panel"),
  secretsPanel: document.querySelector("#secrets-panel"),
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
  ignoreFileState: document.querySelector("#ignore-file-state"),
  ignorePatterns: document.querySelector("#ignore-patterns"),
  maxResults: document.querySelector("#max-results"),
  maxMatchesPerFile: document.querySelector("#max-matches-per-file"),
  maxFiles: document.querySelector("#max-files"),
  timeoutMs: document.querySelector("#timeout-ms"),
  maxLineChars: document.querySelector("#max-line-chars"),
  maxFileBytes: document.querySelector("#max-file-bytes"),
  reloadConfig: document.querySelector("#reload-config"),
  validatePaths: document.querySelector("#validate-paths"),
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
  promptsList: document.querySelector("#prompts-list"),
  promptsEmpty: document.querySelector("#prompts-empty"),
  promptTemplate: document.querySelector("#prompt-row-template"),
  addPrompt: document.querySelector("#add-prompt"),
  promptSearchForm: document.querySelector("#prompt-search-form"),
  promptSearchQuery: document.querySelector("#prompt-search-query"),
  runPromptSearch: document.querySelector("#run-prompt-search"),
  promptSearchSummary: document.querySelector("#prompt-search-summary"),
  promptSearchResults: document.querySelector("#prompt-search-results"),
  secretFilesList: document.querySelector("#secret-files-list"),
  secretFilesEmpty: document.querySelector("#secret-files-empty"),
  secretFileTemplate: document.querySelector("#secret-file-row-template"),
  secretDropZone: document.querySelector("#secret-drop-zone"),
  secretDropHelp: document.querySelector("#secret-drop-help"),
  secretOpenDropBox: document.querySelector("#secret-open-drop-box"),
  addSecretFile: document.querySelector("#add-secret-file"),
  pickSecretFile: document.querySelector("#pick-secret-file"),
  secretSearchForm: document.querySelector("#secret-search-form"),
  secretSearchQuery: document.querySelector("#secret-search-query"),
  runSecretSearch: document.querySelector("#run-secret-search"),
  secretSearchSummary: document.querySelector("#secret-search-summary"),
  secretSearchResults: document.querySelector("#secret-search-results"),
  toast: document.querySelector("#toast")
};

const state = {
  config: null,
  check: null,
  sourceKey: "local",
  activeTab: "prompts",
  dirty: false,
  toastTimer: null,
  pathValidationCounter: 0,
  folderScanResults: new Map()
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

function splitKeywords(value) {
  const seen = new Set();
  return value
    .split(/[;,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      const comparable = entry.toLowerCase();
      if (seen.has(comparable)) {
        return false;
      }
      seen.add(comparable);
      return true;
    });
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
  elements.pageStatus.className = `actionbar-status is-${kind}`;
  elements.pageStatus.querySelector(".actionbar-status-icon").textContent = kind === "error" ? "!" : kind === "warning" ? "△" : "✓";
  elements.pageStatus.querySelector("strong").textContent = title;
  elements.pageStatus.querySelector("p").textContent = description;
}

function markDirty() {
  if (!state.config) {
    return;
  }
  state.dirty = true;
  elements.dirtyState.textContent = "Unsaved changes";
  elements.dirtyState.classList.add("is-dirty");
  elements.saveConfig.classList.add("is-dirty");
  elements.saveConfig.disabled = false;
}

function markClean() {
  state.dirty = false;
  elements.dirtyState.textContent = "No unsaved changes";
  elements.dirtyState.classList.remove("is-dirty");
  elements.saveConfig.classList.remove("is-dirty");
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

function folderScanKey(directoryPath) {
  return comparableLocalPath(directoryPath);
}

function scanFileKey(filePath) {
  return comparableLocalPath(filePath);
}

function uniqueNameFromSet(baseName, names) {
  if (!names.has(baseName.toLowerCase())) {
    return baseName;
  }
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${baseName}-${suffix}`;
    if (!names.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return `${baseName}-${Date.now()}`;
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

function uniqueDocumentFileName(baseName) {
  return uniqueNameInList(elements.filesList, baseName);
}

function uniqueToolDirectoryName(baseName) {
  return uniqueNameInList(elements.toolDirectoriesList, baseName);
}

function uniqueToolFileName(baseName) {
  return uniqueNameInList(elements.toolFilesList, baseName);
}

function uniqueSecretName(baseName) {
  return uniqueNameInList(elements.secretFilesList, baseName);
}

function uniquePromptName(baseName) {
  return uniqueNameInList(elements.promptsList, baseName);
}

function attachConfigurationInput(input) {
  input.addEventListener("input", markDirty);
  input.addEventListener("change", markDirty);
}

function entryEnabled(entry) {
  return typeof entry === "string" || entry?.enabled !== false;
}

function refreshEntryEnabledState(row, pathState) {
  const enabledInput = row.querySelector('[data-field="enabled"]');
  const enabled = enabledInput?.checked !== false;
  const enabledLabel = row.querySelector('[data-role="enabled-label"]');
  const validationStatus = pathState?.dataset.activeStatus ?? "idle";
  const activeText = pathState?.dataset.activeText ?? "";
  row.classList.toggle("is-disabled", !enabled);
  if (enabledLabel) {
    enabledLabel.textContent = enabled ? "Enabled" : "Disabled";
  }
  if (pathState) {
    pathState.textContent = enabled
      ? activeText
      : activeText
        ? `Disabled · ${activeText}`
        : "Disabled · this saved grant is inactive";
    row.classList.toggle("has-path-state", pathState.textContent.length > 0);
    pathState.classList.toggle("is-valid", validationStatus === "valid");
    pathState.classList.toggle("is-invalid", validationStatus === "invalid");
    pathState.classList.toggle("is-pending", validationStatus === "pending");
    row.classList.toggle("is-path-valid", validationStatus === "valid");
    row.classList.toggle("is-path-invalid", validationStatus === "invalid");
  }
}

function setEntryPathState(row, pathState, text = "", status = "idle", title = "") {
  const normalizedStatus = status === true ? "invalid" : status === false ? "idle" : status;
  const pathInput = row.querySelector('[data-field="path"]');
  pathState.dataset.activeText = text;
  pathState.dataset.activeStatus = normalizedStatus;
  pathState.title = title;
  if (normalizedStatus === "invalid") {
    pathInput?.setAttribute("aria-invalid", "true");
  } else {
    pathInput?.removeAttribute("aria-invalid");
  }
  refreshEntryEnabledState(row, pathState);
}

function availabilityState(availability, expectedKind) {
  if (!availability || availability.available === null) {
    return { text: "Path has not been validated", status: "pending", title: "" };
  }
  if (availability.available === true) {
    return {
      text: expectedKind === "directory" ? "Valid directory" : "Valid file",
      status: "valid",
      title: availability.path ?? ""
    };
  }
  if (availability.type === "link") {
    return {
      text: "Invalid · links and junctions are not allowed",
      status: "invalid",
      title: availability.error ?? ""
    };
  }
  if (availability.type && availability.type !== expectedKind) {
    return {
      text: expectedKind === "directory" ? "Invalid · expected a directory" : "Invalid · expected a regular file",
      status: "invalid",
      title: availability.error ?? ""
    };
  }
  return {
    text: "Invalid · path is unavailable",
    status: "invalid",
    title: availability.error ?? ""
  };
}

function applyEntryAvailability(row, pathState, availability, expectedKind) {
  const next = availabilityState(availability, expectedKind);
  setEntryPathState(row, pathState, next.text, next.status, next.title);
}

function initializePathValidation(row, pathState, pathInput, kind) {
  state.pathValidationCounter += 1;
  row.dataset.pathValidationId = `path-${state.pathValidationCounter}`;
  row.dataset.pathKind = kind;
  pathInput.addEventListener("input", () => {
    delete pathState.dataset.validDetail;
    const hasPath = pathInput.value.trim().length > 0;
    setEntryPathState(
      row,
      pathState,
      hasPath ? "Not validated · path changed" : `${kind === "directory" ? "Directory" : "File"} path is required`,
      hasPath ? "pending" : "invalid"
    );
  });
  pathInput.addEventListener("blur", () => validatePathRows([row]));
}

function initializeEntryToggle(row, pathState, enabled) {
  const enabledInput = row.querySelector('[data-field="enabled"]');
  enabledInput.checked = enabled;
  enabledInput.addEventListener("change", () => refreshEntryEnabledState(row, pathState));
  refreshEntryEnabledState(row, pathState);
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
  applyEntryAvailability(row, pathState, availability, "directory");
  initializeEntryToggle(row, pathState, entryEnabled(normalized));
  initializePathValidation(row, pathState, pathInput, "directory");

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

function appendFile(file = {}, availability = undefined) {
  const fragment = elements.fileTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const pathState = row.querySelector('[data-role="state"]');
  nameInput.value = file.name ?? "";
  pathInput.value = file.path ?? "";
  applyEntryAvailability(row, pathState, availability, "file");
  initializeEntryToggle(row, pathState, entryEnabled(file));
  initializePathValidation(row, pathState, pathInput, "file");

  for (const input of row.querySelectorAll("input")) {
    attachConfigurationInput(input);
  }
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
  const noteInput = row.querySelector('[data-role="folder-human-note"]');

  const normalized = typeof directory === "string"
    ? { path: directory, priority: 0, recursive: true, includeDocs: true }
    : directory;
  nameInput.value = normalized.name ?? friendlyPathName(normalized.path ?? "", "tool-folder");
  pathInput.value = normalized.path ?? "";
  priorityInput.value = normalized.priority ?? 0;
  recursiveInput.checked = normalized.recursive !== false;
  includeDocsInput.checked = normalized.includeDocs !== false;
  noteInput.value = normalized.humanNote ?? "";
  applyEntryAvailability(row, pathState, availability, "directory");
  initializeEntryToggle(row, pathState, entryEnabled(normalized));
  initializePathValidation(row, pathState, pathInput, "directory");
  row.dataset.folderScanKey = folderScanKey(pathInput.value);
  pathInput.addEventListener("input", () => {
    const nextKey = folderScanKey(pathInput.value);
    if (row.dataset.folderScanKey !== nextKey) {
      state.folderScanResults.delete(row.dataset.folderScanKey);
      row.dataset.folderScanKey = nextKey;
    }
    renderFolderScanResults(row);
  });
  priorityInput.addEventListener("input", () => renderFolderScanResults(row));
  noteInput.addEventListener("input", markDirty);
  for (const input of row.querySelectorAll("input")) {
    attachConfigurationInput(input);
  }
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    state.folderScanResults.delete(row.dataset.folderScanKey);
    row.remove();
    updateEmptyStates();
    markDirty();
  });
  row.querySelector('[data-action="scan-tool"]').addEventListener("click", () => runFolderScan(row, "tool"));
  row.querySelector('[data-action="scan-document"]').addEventListener("click", () => runFolderScan(row, "document"));
  seedFolderScanResults(row, normalized);
  renderFolderScanResults(row);

  elements.toolDirectoriesList.append(row);
  updateEmptyStates();
  return row;
}

function setFolderScanBusy(row, activeButton, busy) {
  const buttons = [...row.querySelectorAll('[data-action="scan-tool"], [data-action="scan-document"]')];
  for (const button of buttons) {
    if (busy) {
      button.dataset.previousLabel = button.textContent;
      if (button === activeButton) {
        button.textContent = "Scanning...";
      }
      button.disabled = true;
      continue;
    }
    if (button.dataset.previousLabel) {
      button.textContent = button.dataset.previousLabel;
      delete button.dataset.previousLabel;
    }
    button.disabled = false;
  }
}

function persistedFolderScan(kind, entries) {
  if (entries.length === 0) {
    return undefined;
  }
  return {
    payload: {
      kind,
      results: entries.map((entry) => ({ path: entry.path })),
      meta: { hasMore: false, truncated: false },
      warnings: []
    },
    entries
  };
}

function seedFolderScanResults(row, directory) {
  const key = row.dataset.folderScanKey;
  if (!key) {
    return;
  }
  const tool = persistedFolderScan("tool", (directory.scannedToolFiles ?? []).map((file) => ({
    name: file.name,
    path: file.path,
    priority: file.priority,
    enabled: file.enabled !== false
  })));
  const document = persistedFolderScan("document", (directory.scannedDocumentFiles ?? []).map((file) => ({
    name: file.name,
    path: file.path,
    enabled: file.enabled !== false
  })));
  if (tool || document) {
    state.folderScanResults.set(key, { ...(tool ? { tool } : {}), ...(document ? { document } : {}) });
  }
}

function scanEntryNameBase(folderName, filePath, kind) {
  const folderPart = friendlyPathName(folderName, "tool-folder");
  const filePart = friendlyPathName(filePath, kind === "tool" ? "tool-file" : "document-file");
  return `${folderPart}-${filePart}`;
}

function usedScannedEntryNames(kind, excludedFolderKey) {
  const inputs = kind === "tool"
    ? elements.toolFilesList.querySelectorAll('[data-field="name"]')
    : elements.filesList.querySelectorAll('[data-field="name"]');
  const names = new Set([...inputs]
    .map((input) => input.value.trim().toLowerCase())
    .filter(Boolean));
  for (const [folderKey, results] of state.folderScanResults) {
    if (folderKey === excludedFolderKey) {
      continue;
    }
    for (const entry of results[kind]?.entries ?? []) {
      if (entry.name?.trim()) {
        names.add(entry.name.trim().toLowerCase());
      }
    }
  }
  return names;
}

function storeFolderScanResult(folderRow, payload) {
  const directoryPath = folderRow.querySelector('[data-field="path"]').value.trim();
  const key = folderScanKey(directoryPath);
  if (!key) {
    return;
  }
  const folderResults = state.folderScanResults.get(key) ?? {};
  const previousEntries = new Map((folderResults[payload.kind]?.entries ?? [])
    .map((entry) => [scanFileKey(entry.path), entry]));
  const folderName = folderRow.querySelector('[data-field="name"]').value.trim();
  const folderPriority = Number(folderRow.querySelector('[data-field="priority"]').value);
  const namesInUse = usedScannedEntryNames(payload.kind, key);
  const returnedPaths = new Set(payload.results.map((result) => scanFileKey(result.path)));
  for (const entry of previousEntries.values()) {
    if (returnedPaths.has(scanFileKey(entry.path)) && entry.name?.trim()) {
      namesInUse.add(entry.name.trim().toLowerCase());
    }
  }
  folderResults[payload.kind] = {
    payload,
    entries: payload.results.map((result) => {
      const previous = previousEntries.get(scanFileKey(result.path));
      const name = previous?.name?.trim()
        || uniqueNameFromSet(scanEntryNameBase(folderName, result.path, payload.kind), namesInUse);
      namesInUse.add(name.toLowerCase());
      return payload.kind === "tool"
        ? {
            name,
            path: result.path,
            priority: Number.isInteger(previous?.priority) ? previous.priority : folderPriority,
            enabled: previous?.enabled !== false
          }
        : {
            name,
            path: result.path,
            enabled: previous?.enabled !== false
          };
    })
  };
  state.folderScanResults.set(key, folderResults);
  folderRow.dataset.folderScanKey = key;
}

function scanContentIsVisible(scan) {
  return Boolean(scan && (scan.payload.results.length === 0 || scan.entries.length > 0));
}

function removeScannedFilePreview(folderRow, kind, filePath) {
  const folderKey = folderRow.dataset.folderScanKey || folderScanKey(folderRow.querySelector('[data-field="path"]').value);
  const scan = state.folderScanResults.get(folderKey)?.[kind];
  if (!scan) {
    return;
  }
  scan.entries = scan.entries.filter((entry) => scanFileKey(entry.path) !== scanFileKey(filePath));
  renderFolderScanResults(folderRow);
  markDirty();
}

function createScannedFileRow(folderRow, entry, kind, toolPriority) {
  const row = document.createElement("article");
  row.className = kind === "tool" ? "scan-exact-row scan-tool-file-grid" : "scan-exact-row scan-document-file-grid";
  row.setAttribute("role", "listitem");
  row.setAttribute(
    "aria-label",
    kind === "tool"
      ? "Saved scanned tool selection. This file is registered as an exact tool file when the configuration is saved."
      : "Saved scanned document selection. This file is registered as an exact document file when the configuration is saved."
  );

  const name = document.createElement("input");
  name.className = "scan-exact-field scan-exact-name";
  name.type = "text";
  name.maxLength = 200;
  name.value = entry.name ?? friendlyPathName(entry.path, kind === "tool" ? "tool-file" : "document-file");
  name.setAttribute("aria-label", kind === "tool" ? "Scanned tool name or alias" : "Scanned document name or alias");
  name.title = "Unique name or alias";
  name.addEventListener("input", () => {
    entry.name = name.value;
    markDirty();
  });

  const filePath = document.createElement("div");
  filePath.className = "scan-exact-field scan-exact-path";
  filePath.textContent = entry.path;
  filePath.title = entry.path;

  row.append(name, filePath);

  if (kind === "tool") {
    const priority = document.createElement("input");
    priority.className = "scan-exact-field scan-exact-priority";
    priority.type = "number";
    priority.min = "-10000";
    priority.max = "10000";
    priority.value = String(Number.isInteger(entry.priority) ? entry.priority : Number(toolPriority));
    priority.setAttribute("aria-label", "Scanned tool priority");
    priority.title = "Individual tool priority";
    priority.addEventListener("input", () => {
      entry.priority = Number(priority.value);
      markDirty();
    });
    row.append(priority);
  }

  const enabled = document.createElement("label");
  enabled.className = "entry-enabled scan-entry-enabled";
  const enabledInput = document.createElement("input");
  enabledInput.type = "checkbox";
  enabledInput.dataset.field = "enabled";
  enabledInput.setAttribute("aria-label", `Enable scanned ${kind} file ${entry.path}`);
  const enabledSwitch = document.createElement("span");
  enabledSwitch.className = "entry-switch";
  enabledSwitch.setAttribute("aria-hidden", "true");
  const enabledLabel = document.createElement("span");
  enabledLabel.dataset.role = "enabled-label";
  enabled.append(enabledInput, enabledSwitch, enabledLabel);

  const remove = document.createElement("button");
  remove.className = "icon-button scan-remove-button";
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove scanned ${kind} file ${entry.path}`);
  remove.textContent = "×";
  remove.addEventListener("click", () => removeScannedFilePreview(folderRow, kind, entry.path));
  row.append(enabled, remove);
  initializeEntryToggle(row, null, entry.enabled);
  enabledInput.addEventListener("change", () => {
    entry.enabled = enabledInput.checked;
    markDirty();
  });
  return row;
}

function renderFolderScanResultContent(folderRow, content, scan, kind, toolPriority) {
  content.replaceChildren();
  if (!scanContentIsVisible(scan)) {
    content.hidden = true;
    return;
  }
  content.hidden = false;
  const { payload, entries } = scan;

  if (payload.meta.hasMore) {
    const warning = document.createElement("p");
    warning.className = "folder-scan-warning";
    warning.textContent = "Showing the first 100 matching results. Additional matches were found; refine the matching rules or scan a more specific folder.";
    content.append(warning);
  } else if (payload.meta.truncated) {
    const warning = document.createElement("p");
    warning.className = "folder-scan-warning";
    warning.textContent = payload.warnings[0]?.message ?? "The scan stopped before it could finish.";
    content.append(warning);
  }

  if (payload.results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = `No matching ${payload.kind === "tool" ? "tools" : "documents"} were found in this folder.`;
    content.append(empty);
    return;
  }

  const files = document.createElement("div");
  files.className = "scan-exact-list";
  files.setAttribute("role", "list");
  for (const entry of entries) {
    files.append(createScannedFileRow(folderRow, entry, kind, toolPriority));
  }
  content.append(files);
}

function renderFolderScanResults(row) {
  const results = row.querySelector('[data-role="scan-results"]');
  if (!results) {
    return;
  }

  const stored = state.folderScanResults.get(row.dataset.folderScanKey);
  results.hidden = !scanContentIsVisible(stored?.tool) && !scanContentIsVisible(stored?.document);
  if (results.hidden) {
    return;
  }

  const toolPriority = row.querySelector('[data-field="priority"]').value;
  renderFolderScanResultContent(row, results.querySelector('[data-role="tool-scan-result-content"]'), stored.tool, "tool", toolPriority);
  renderFolderScanResultContent(row, results.querySelector('[data-role="document-scan-result-content"]'), stored.document, "document");
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
  applyEntryAvailability(row, pathState, availability, "file");
  initializeEntryToggle(row, pathState, entryEnabled(normalized));
  initializePathValidation(row, pathState, pathInput, "file");

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

function appendSecretFile(secretFile = {}, inspection = undefined) {
  const fragment = elements.secretFileTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const formatInput = row.querySelector('[data-field="format"]');
  const pathState = row.querySelector('[data-role="state"]');

  const normalized = typeof secretFile === "string" ? { path: secretFile, format: "auto" } : secretFile;
  nameInput.value = normalized.name ?? friendlyPathName(normalized.path ?? "", "secret-file");
  pathInput.value = normalized.path ?? "";
  formatInput.value = normalized.format ?? "auto";

  if (inspection?.available === false) {
    setEntryPathState(
      row,
      pathState,
      inspection.error ? "Invalid · secret file is unavailable" : "Invalid · expected a regular secret file",
      "invalid",
      inspection.error ?? ""
    );
  } else if (inspection?.format === "env") {
    const fields = inspection.fields?.length ? inspection.fields.join(", ") : "no fields detected";
    pathState.dataset.validDetail = `key/value · ${fields} · values hidden`;
    setEntryPathState(row, pathState, `Valid file · ${pathState.dataset.validDetail}`, "valid", inspection.path ?? "");
  } else if (inspection?.format === "opaque") {
    pathState.dataset.validDetail = "opaque value · value hidden";
    setEntryPathState(row, pathState, `Valid file · ${pathState.dataset.validDetail}`, "valid", inspection.path ?? "");
  } else {
    applyEntryAvailability(row, pathState, inspection, "file");
  }
  initializeEntryToggle(row, pathState, entryEnabled(normalized));
  initializePathValidation(row, pathState, pathInput, "file");

  const markForReinspection = () => {
    delete pathState.dataset.validDetail;
    setEntryPathState(row, pathState, "Not validated · save to refresh detected fields", "pending");
  };
  for (const input of row.querySelectorAll("input, select")) {
    attachConfigurationInput(input);
  }
  formatInput.addEventListener("change", markForReinspection);
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    row.remove();
    updateEmptyStates();
    markDirty();
  });

  elements.secretFilesList.append(row);
  updateEmptyStates();
  return row;
}

function appendPrompt(prompt = {}) {
  const fragment = elements.promptTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const keywordsInput = row.querySelector('[data-field="keywords"]');
  const contentInput = row.querySelector('[data-field="content"]');

  nameInput.value = prompt.name ?? uniquePromptName("reusable-prompt");
  keywordsInput.value = Array.isArray(prompt.keywords) ? prompt.keywords.join(";") : (prompt.keywords ?? "");
  contentInput.value = prompt.content ?? "";
  initializeEntryToggle(row, null, entryEnabled(prompt));

  for (const input of row.querySelectorAll("input, textarea")) {
    attachConfigurationInput(input);
  }
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    row.remove();
    updateEmptyStates();
    markDirty();
  });

  elements.promptsList.append(row);
  updateEmptyStates();
  return row;
}

function updateEmptyStates() {
  elements.rootsEmpty.hidden = elements.rootsList.children.length > 0;
  elements.filesEmpty.hidden = elements.filesList.children.length > 0;
  elements.toolDirectoriesEmpty.hidden = elements.toolDirectoriesList.children.length > 0;
  elements.toolFilesEmpty.hidden = elements.toolFilesList.children.length > 0;
  elements.promptsEmpty.hidden = elements.promptsList.children.length > 0;
  elements.secretFilesEmpty.hidden = elements.secretFilesList.children.length > 0;
}

function setIgnoreFilePathState(text, status = "idle", title = "") {
  const field = elements.ignoreFile.closest(".field");
  elements.ignoreFileState.textContent = text;
  elements.ignoreFileState.dataset.validationStatus = status;
  elements.ignoreFileState.title = title;
  field?.classList.toggle("is-path-valid", status === "valid");
  field?.classList.toggle("is-path-invalid", status === "invalid");
  if (status === "invalid") {
    elements.ignoreFile.setAttribute("aria-invalid", "true");
  } else {
    elements.ignoreFile.removeAttribute("aria-invalid");
  }
}

function validationResultText(result) {
  if (result.valid) {
    return result.kind === "directory" ? "Valid directory" : "Valid file";
  }
  if (result.code === "PATH_EMPTY") {
    return result.kind === "directory" ? "Invalid · directory path is required" : "Invalid · file path is required";
  }
  if (result.code === "PATH_TYPE_MISMATCH") {
    return result.kind === "directory" ? "Invalid · expected a directory" : "Invalid · expected a regular file";
  }
  if (result.code === "PATH_LINK_NOT_ALLOWED") {
    return "Invalid · links and junctions are not allowed";
  }
  if (/ENOENT|no such file|cannot find|does not exist/i.test(result.message ?? "")) {
    return "Invalid · path does not exist";
  }
  if (/EACCES|EPERM|access.*denied|permission/i.test(result.message ?? "")) {
    return "Invalid · path is not readable";
  }
  return "Invalid · path is unavailable";
}

function pathValidationTarget(row) {
  const pathInput = row.querySelector('[data-field="path"]');
  const pathState = row.querySelector('[data-role="state"]');
  return {
    id: row.dataset.pathValidationId,
    kind: row.dataset.pathKind,
    path: pathInput.value.trim(),
    enabled: row.querySelector('[data-field="enabled"]')?.checked !== false,
    setChecking() {
      setEntryPathState(row, pathState, "Checking path…", "pending");
    },
    apply(result) {
      if (pathInput.value.trim() !== result.inputPath) {
        return;
      }
      setEntryPathState(
        row,
        pathState,
        result.valid && pathState.dataset.validDetail
          ? `${validationResultText(result)} · ${pathState.dataset.validDetail}`
          : validationResultText(result),
        result.valid ? "valid" : "invalid",
        result.valid ? result.path : result.message
      );
    },
    fail(message) {
      setEntryPathState(row, pathState, "Path check failed", "pending", message);
    }
  };
}

function ignoreFileValidationTarget() {
  const inputPath = elements.ignoreFile.value.trim();
  if (!inputPath) {
    setIgnoreFilePathState("Optional path is not configured.");
    return null;
  }
  return {
    id: "ignore-file",
    kind: "file",
    path: inputPath,
    enabled: true,
    setChecking() {
      setIgnoreFilePathState("Checking path…", "pending");
    },
    apply(result) {
      if (elements.ignoreFile.value.trim() !== result.inputPath) {
        return;
      }
      setIgnoreFilePathState(
        validationResultText(result),
        result.valid ? "valid" : "invalid",
        result.valid ? result.path : result.message
      );
    },
    fail(message) {
      setIgnoreFilePathState("Path check failed", "pending", message);
    }
  };
}

function allPathValidationRows() {
  return [
    ...elements.rootsList.querySelectorAll(".entry-row"),
    ...elements.filesList.querySelectorAll(".entry-row"),
    ...elements.toolDirectoriesList.querySelectorAll(".entry-row"),
    ...elements.toolFilesList.querySelectorAll(".entry-row"),
    ...elements.secretFilesList.querySelectorAll(".entry-row")
  ];
}

async function validatePathTargets(targets, announce = false) {
  const usableTargets = targets.filter(Boolean);
  if (usableTargets.length === 0) {
    if (announce) {
      setPageStatus("ready", "No paths to validate", "Add a directory or exact file, or configure an ignore file path.");
      showToast("No directory or file paths are currently configured.");
    }
    return null;
  }

  for (const target of usableTargets) {
    target.setChecking();
  }

  try {
    const payload = await api("/api/validate-paths", {
      method: "POST",
      body: {
        entries: usableTargets.map(({ id, kind, path: inputPath, enabled }) => ({ id, kind, path: inputPath, enabled }))
      }
    });
    const targetById = new Map(usableTargets.map((target) => [target.id, target]));
    for (const result of payload.entries) {
      targetById.get(result.id)?.apply(result);
    }

    if (payload.summary.invalid > 0) {
      const description = `${payload.summary.invalid} invalid: ${payload.summary.enabledInvalid} enabled and ${payload.summary.disabledInvalid} disabled.`;
      setPageStatus("warning", "Path validation found issues", description);
      if (announce) {
        showToast(`${payload.summary.invalid} path(s) need attention.`, "error");
      }
    } else if (announce) {
      setPageStatus("ready", "All paths are valid", `${payload.summary.valid} path(s) are readable and have the expected type.`);
      showToast(`Validated ${payload.summary.valid} path(s).`);
    }
    return payload;
  } catch (error) {
    for (const target of usableTargets) {
      target.fail(error.message);
    }
    if (announce) {
      setPageStatus("error", "Could not validate paths", error.message);
      showToast(error.message, "error");
    }
    return null;
  }
}

function validatePathRows(rows, announce = false) {
  return validatePathTargets(rows.map(pathValidationTarget), announce);
}

async function validateAllPaths() {
  setBusy(elements.validatePaths, true, "Validating…");
  try {
    const targets = allPathValidationRows().map(pathValidationTarget);
    targets.push(ignoreFileValidationTarget());
    await validatePathTargets(targets, true);
  } finally {
    setBusy(elements.validatePaths, false);
  }
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
  const prompts = Array.isArray(config.prompts) ? config.prompts : [];
  const secrets = config.secrets ?? { files: [], maxFileBytes: 256_000 };
  const checkedSecrets = check?.secrets;

  state.folderScanResults.clear();

  elements.rootsList.replaceChildren();
  elements.filesList.replaceChildren();
  elements.toolDirectoriesList.replaceChildren();
  elements.toolFilesList.replaceChildren();
  elements.promptsList.replaceChildren();
  elements.secretFilesList.replaceChildren();
  for (const root of (source.roots ?? [])) {
    const rootName = typeof root === "string" ? undefined : root.name;
    const availability = rootName
      ? checkedSource?.roots?.find((entry) => entry.name === rootName)
      : undefined;
    appendRoot(root, availability);
  }
  for (const [index, file] of (source.files ?? []).entries()) {
    const availability = checkedSource?.files?.find((entry) => entry.name === file.name)
      ?? checkedSource?.files?.[index];
    appendFile(file, availability);
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
  for (const prompt of prompts) {
    appendPrompt(prompt);
  }
  for (const [index, secretFile] of (secrets.files ?? []).entries()) {
    const secretName = typeof secretFile === "string" ? undefined : secretFile.name;
    const inspection = secretName
      ? checkedSecrets?.files?.find((entry) => entry.name === secretName)
      : checkedSecrets?.files?.[index];
    appendSecretFile(secretFile, inspection);
  }

  elements.extensions.value = extensionText(source.extensions);
  elements.fileNames.value = (source.fileNames ?? []).join(";");
  elements.caseSensitive.checked = config.caseSensitive === true;
  elements.ignoreFile.value = config.ignoreFile ?? "";
  if (elements.ignoreFile.value.trim()) {
    setIgnoreFilePathState("Valid file", "valid", check?.ignoreFile ?? elements.ignoreFile.value.trim());
  } else {
    setIgnoreFilePathState("Optional path is not configured.");
  }
  elements.ignorePatterns.value = (config.ignore ?? []).join("\n");
  elements.maxResults.value = config.limits?.maxResults ?? 50;
  elements.maxMatchesPerFile.value = config.limits?.maxMatchesPerFile ?? 1;
  elements.maxFiles.value = config.limits?.maxFiles ?? 50_000;
  elements.timeoutMs.value = config.limits?.timeoutMs ?? 15_000;
  elements.maxLineChars.value = config.limits?.maxLineChars ?? 1_000;
  elements.maxFileBytes.value = config.limits?.maxFileBytes ?? 2_000_000;
  elements.toolExtensions.value = extensionText(tools.extensions);

  const unavailableRoots = checkedSource?.roots?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableFiles = checkedSource?.files?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableToolDirectories = checkedTools?.directories?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableToolFiles = checkedTools?.files?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableSecrets = checkedSecrets?.files?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableTotal = unavailableRoots + unavailableFiles + unavailableToolDirectories + unavailableToolFiles + unavailableSecrets;
  const configuredEntries = [
    ...(source.roots ?? []),
    ...(source.files ?? []),
    ...(tools.directories ?? []),
    ...(tools.directories ?? []).flatMap((directory) => directory.scannedToolFiles ?? []),
    ...(tools.directories ?? []).flatMap((directory) => directory.scannedDocumentFiles ?? []),
    ...(tools.files ?? []),
    ...prompts,
    ...(secrets.files ?? [])
  ];
  const enabledTotal = configuredEntries.filter(entryEnabled).length;
  const disabledTotal = configuredEntries.length - enabledTotal;
  if (unavailableTotal > 0) {
    setPageStatus("warning", "Configuration loaded with unavailable paths", `${unavailableTotal} document, tool, or secret path(s) need attention.`);
  } else {
    setPageStatus(
      "ready",
      "Configuration is valid",
      `${enabledTotal} enabled and ${disabledTotal} disabled across Prompts, Documents, Tools, and Secrets.`
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

function requireUniqueNames(entries, label) {
  const names = new Set();
  for (const entry of entries) {
    const comparableName = entry.name.toLowerCase();
    if (names.has(comparableName)) {
      throw new Error(`${label} name '${entry.name}' is used more than once.`);
    }
    names.add(comparableName);
  }
}

function folderScanEntries(row, kind) {
  return state.folderScanResults.get(row.dataset.folderScanKey)?.[kind]?.entries ?? [];
}

function collectScannedToolFiles(row, folderIndex) {
  return folderScanEntries(row, "tool").map((entry, index) => {
    const name = entry.name?.trim() ?? "";
    const filePath = entry.path?.trim() ?? "";
    const priority = Number(entry.priority);
    if (!name || !filePath || !Number.isInteger(priority)) {
      throw new Error(`Scanned tool ${index + 1} in tool folder ${folderIndex + 1} needs a name, path, and integer priority.`);
    }
    return { name, path: filePath, priority, enabled: entry.enabled !== false };
  });
}

function collectScannedDocumentFiles(row, folderIndex) {
  return folderScanEntries(row, "document").map((entry, index) => {
    const name = entry.name?.trim() ?? "";
    const filePath = entry.path?.trim() ?? "";
    if (!name || !filePath) {
      throw new Error(`Scanned document ${index + 1} in tool folder ${folderIndex + 1} needs a name and path.`);
    }
    return { name, path: filePath, enabled: entry.enabled !== false };
  });
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
    return {
      name,
      path: folderPath,
      priority,
      enabled: row.querySelector('[data-field="enabled"]').checked
    };
  });
  requireUniqueNames(source.roots, "Allowed folder");

  source.files = [...elements.filesList.querySelectorAll(".entry-row")].map((row, index) => {
    const name = row.querySelector('[data-field="name"]').value.trim();
    const filePath = row.querySelector('[data-field="path"]').value.trim();
    if (!name || !filePath) {
      throw new Error(`Exact file ${index + 1} needs a name and path.`);
    }
    return {
      name,
      path: filePath,
      enabled: row.querySelector('[data-field="enabled"]').checked
    };
  });
  requireUniqueNames(source.files, "Exact file");

  next.tools = {
    directories: [...elements.toolDirectoriesList.querySelectorAll(".entry-row")].map((row, index) => {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const folderPath = row.querySelector('[data-field="path"]').value.trim();
      const priority = Number(row.querySelector('[data-field="priority"]').value);
      if (!name || !folderPath || !Number.isInteger(priority)) {
        throw new Error(`Tool folder ${index + 1} needs a name, path, and integer priority.`);
      }
      const directory = {
        name,
        path: folderPath,
        priority,
        recursive: row.querySelector('[data-field="recursive"]').checked,
        includeDocs: row.querySelector('[data-field="includeDocs"]').checked,
        enabled: row.querySelector('[data-field="enabled"]').checked
      };
      const humanNote = row.querySelector('[data-role="folder-human-note"]').value.trim();
      const scannedToolFiles = collectScannedToolFiles(row, index);
      const scannedDocumentFiles = collectScannedDocumentFiles(row, index);
      if (humanNote) {
        directory.humanNote = humanNote;
      }
      if (scannedToolFiles.length > 0) {
        directory.scannedToolFiles = scannedToolFiles;
      }
      if (scannedDocumentFiles.length > 0) {
        directory.scannedDocumentFiles = scannedDocumentFiles;
      }
      return directory;
    }),
    files: [...elements.toolFilesList.querySelectorAll(".entry-row")].map((row, index) => {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const filePath = row.querySelector('[data-field="path"]').value.trim();
      const priority = Number(row.querySelector('[data-field="priority"]').value);
      if (!name || !filePath || !Number.isInteger(priority)) {
        throw new Error(`Exact tool ${index + 1} needs a name, path, and integer priority.`);
      }
      return {
        name,
        path: filePath,
        priority,
        enabled: row.querySelector('[data-field="enabled"]').checked
      };
    }),
    extensions: elements.toolExtensions.value.trim() || []
  };
  requireUniqueNames(next.tools.directories, "Tool folder");
  requireUniqueNames([
    ...next.tools.files,
    ...next.tools.directories.flatMap((directory) => directory.scannedToolFiles ?? [])
  ], "Tool file");
  requireUniqueNames([
    ...source.files,
    ...next.tools.directories.flatMap((directory) => directory.scannedDocumentFiles ?? [])
  ], "Exact document file");

  next.secrets = {
    files: [...elements.secretFilesList.querySelectorAll(".entry-row")].map((row, index) => {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const filePath = row.querySelector('[data-field="path"]').value.trim();
      const format = row.querySelector('[data-field="format"]').value;
      if (!name || !filePath || !["auto", "env", "opaque"].includes(format)) {
        throw new Error(`Secret file ${index + 1} needs a name, exact path, and valid format.`);
      }
      return {
        name,
        path: filePath,
        format,
        enabled: row.querySelector('[data-field="enabled"]').checked
      };
    }),
    maxFileBytes: next.secrets?.maxFileBytes ?? 256_000
  };

  const promptNames = new Set();
  next.prompts = [...elements.promptsList.querySelectorAll(".entry-row")].map((row, index) => {
    const name = row.querySelector('[data-field="name"]').value.trim();
    const keywords = splitKeywords(row.querySelector('[data-field="keywords"]').value);
    const content = row.querySelector('[data-field="content"]').value;
    if (!name || !content.trim()) {
      throw new Error(`Reusable prompt ${index + 1} needs a name or alias and prompt text.`);
    }
    const comparableName = name.toLowerCase();
    if (promptNames.has(comparableName)) {
      throw new Error(`Reusable prompt name or alias '${name}' is used more than once.`);
    }
    promptNames.add(comparableName);
    const prompt = {
      name,
      content,
      enabled: row.querySelector('[data-field="enabled"]').checked
    };
    if (keywords.length > 0) {
      prompt.keywords = keywords;
    }
    return prompt;
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
  next.ignore = splitValues(elements.ignorePatterns.value);
  next.limits.maxResults = positiveInteger(elements.maxResults, "Max results");
  next.limits.maxMatchesPerFile = positiveInteger(elements.maxMatchesPerFile, "Snippets per file");
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

async function inspectAndAppendSecretFile(filePath) {
  const name = uniqueSecretName(friendlyPathName(filePath, "secret-file"));
  let inspection;
  try {
    const payload = await api("/api/inspect-secret", {
      method: "POST",
      body: { name, path: filePath, format: "auto" }
    });
    inspection = payload.secret;
  } catch (error) {
    inspection = { available: false, error: error.message };
  }
  const row = appendSecretFile({ name, path: filePath, format: "auto" }, inspection);
  row.querySelector('[data-field="name"]').focus();
  return row;
}

async function pickPath(kind, target = "documents") {
  const button = target === "secrets"
    ? elements.pickSecretFile
    : target === "tools"
    ? (kind === "directory" ? elements.pickToolFolder : elements.pickToolFile)
    : (kind === "directory" ? elements.pickFolder : elements.pickFile);
  setBusy(button, true, "Waiting for picker…");
  try {
    const payload = await api("/api/pick", { method: "POST", body: { kind } });
    if (payload.cancelled) {
      return;
    }
    if (target === "secrets") {
      await inspectAndAppendSecretFile(payload.path);
    } else if (target === "tools" && kind === "directory") {
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
      const row = appendFile({
        name: uniqueDocumentFileName(friendlyPathName(payload.path, "document-file")),
        path: payload.path
      });
      row.querySelector('[data-field="name"]').focus();
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
      const fileName = uniqueDocumentFileName(friendlyPathName(item.path, "document-file"));
      appendFile({ name: fileName, path: item.path });
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

async function addDroppedSecretItems(items, errors = []) {
  const existingFiles = new Set([...elements.secretFilesList.querySelectorAll('[data-field="path"]')]
    .map((input) => comparableLocalPath(input.value)));
  let added = 0;
  let duplicates = 0;
  let rejected = errors.length;

  for (const item of items) {
    if (item.type !== "file") {
      rejected += 1;
      continue;
    }
    const comparable = comparableLocalPath(item.path);
    if (existingFiles.has(comparable)) {
      duplicates += 1;
      continue;
    }
    await inspectAndAppendSecretFile(item.path);
    existingFiles.add(comparable);
    added += 1;
  }

  if (added > 0) {
    markDirty();
  }
  const details = [
    `${added} secret file${added === 1 ? "" : "s"} added`,
    ...(duplicates > 0 ? [`${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped`] : []),
    ...(rejected > 0 ? [`${rejected} folder, link, or unavailable item${rejected === 1 ? "" : "s"} rejected`] : [])
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
  if (target === "secrets") {
    await addDroppedSecretItems(payload.items, payload.errors);
  } else if (target === "tools") {
    addDroppedToolItems(payload.items, payload.errors);
  } else {
    addDroppedItems(payload.items, payload.errors);
  }
}

async function openNativeDropBox(target = "documents") {
  const button = target === "secrets"
    ? elements.secretOpenDropBox
    : target === "tools" ? elements.toolOpenDropBox : elements.openDropBox;
  setBusy(button, true, "Use the open drop box…");
  try {
    const payload = await api("/api/native-drop", { method: "POST", body: {} });
    if (!payload.cancelled) {
      if (target === "secrets") {
        await addDroppedSecretItems(payload.items, payload.errors);
      } else if (target === "tools") {
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
  const dropZone = target === "secrets"
    ? elements.secretDropZone
    : target === "tools" ? elements.toolDropZone : elements.dropZone;
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
    showToast("This browser does not expose complete local paths. Use the browse buttons.", "error");
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
    const duplicateSummary = payload.meta.duplicateFilesOmitted > 0
      ? ` · ${payload.meta.duplicateFilesOmitted} duplicate ${payload.meta.duplicateFilesOmitted === 1 ? "file" : "files"} omitted`
      : "";
    elements.searchSummary.textContent = `${payload.results.length} unique file(s) · ${payload.meta.filesRead} file(s) read${duplicateSummary} · ${payload.meta.elapsedMs} ms${payload.meta.truncated ? " · partial result" : ""}`;

    if (payload.results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching allowed document was found.";
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
      const resultMeta = document.createElement("div");
      resultMeta.className = "result-meta";
      const metaParts = [`${result.matchCount} matching ${result.matchCount === 1 ? "line" : "lines"}`];
      if (result.duplicateCount > 0) {
        metaParts.push(`${result.duplicateCount} identical ${result.duplicateCount === 1 ? "copy" : "copies"} omitted`);
      }
      resultMeta.textContent = metaParts.join(" · ");
      body.append(resultPath, resultText, resultMeta);

      if (result.additionalMatches?.length > 0) {
        const details = document.createElement("details");
        details.className = "result-details";
        const summary = document.createElement("summary");
        summary.textContent = `${result.additionalMatches.length} secondary snippet(s)`;
        details.append(summary);
        for (const match of result.additionalMatches) {
          const secondary = document.createElement("div");
          secondary.className = "result-secondary";
          const secondaryLine = document.createElement("span");
          secondaryLine.textContent = `L${match.lineNumber}`;
          const secondaryText = document.createElement("span");
          secondaryText.textContent = match.lineText;
          secondary.append(secondaryLine, secondaryText);
          details.append(secondary);
        }
        body.append(details);
      }
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

async function runFolderScan(row, kind) {
  const action = kind === "tool" ? "scan-tool" : "scan-document";
  const button = row.querySelector(`[data-action="${action}"]`);
  if (!button) {
    return;
  }

  let config;
  try {
    config = collectConfig();
  } catch (error) {
    showToast(error.message, "error");
    return;
  }

  setFolderScanBusy(row, button, true);
  const directoryPath = row.querySelector('[data-field="path"]').value.trim();
  try {
    const payload = await api("/api/scan-attached-folder", {
      method: "POST",
      body: {
        kind,
        directoryPath,
        config
      }
    });
    storeFolderScanResult(row, payload);
    renderFolderScanResults(row);
    markDirty();
  } catch (error) {
    if (error.code === "UI_NOT_FOUND") {
      showToast("The running Configuration UI needs a restart before folder scans are available. Restart it, then try again.", "error");
    } else {
      showToast(error.message, "error");
    }
  } finally {
    setFolderScanBusy(row, button, false);
  }
}

async function runSecretSearch(event) {
  event.preventDefault();
  if (state.dirty) {
    showToast("Save your configuration before testing secret discovery.", "error");
    return;
  }

  setBusy(elements.runSecretSearch, true, "Resolving…");
  elements.secretSearchSummary.hidden = true;
  elements.secretSearchResults.replaceChildren();
  try {
    const payload = await api("/api/find-secret", {
      method: "POST",
      body: { query: elements.secretSearchQuery.value.trim() }
    });
    elements.secretSearchSummary.hidden = false;
    elements.secretSearchSummary.textContent = `${payload.results.length} result(s) · ${payload.meta.secretFilesConfigured} exact secret file(s) · values not returned`;

    if (payload.results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching configured secret was found.";
      elements.secretSearchResults.append(empty);
      return;
    }

    for (const result of payload.results) {
      const article = document.createElement("article");
      article.className = "result tool-result";
      const badge = document.createElement("div");
      badge.className = "result-line tool-type";
      badge.textContent = result.format === "env" ? "ENV" : "VALUE";
      const body = document.createElement("div");
      const heading = document.createElement("strong");
      heading.className = "result-name";
      heading.textContent = result.name;
      const resultPath = document.createElement("div");
      resultPath.className = "result-path";
      resultPath.textContent = result.path;
      const resultText = document.createElement("div");
      resultText.className = "result-text";
      resultText.textContent = result.format === "env"
        ? `Detected fields: ${result.fields.join(", ")} · values hidden · not searchable`
        : "Opaque token, password, or key · value hidden · not searchable";
      body.append(heading, resultPath, resultText);
      article.append(badge, body);
      elements.secretSearchResults.append(article);
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(elements.runSecretSearch, false);
  }
}

async function runPromptSearch(event) {
  event.preventDefault();
  if (state.dirty) {
    showToast("Save your configuration before testing prompt discovery.", "error");
    return;
  }

  setBusy(elements.runPromptSearch, true, "Resolving…");
  elements.promptSearchSummary.hidden = true;
  elements.promptSearchResults.replaceChildren();
  try {
    const payload = await api("/api/find-prompt", {
      method: "POST",
      body: { query: elements.promptSearchQuery.value.trim() }
    });
    elements.promptSearchSummary.hidden = false;
    elements.promptSearchSummary.textContent = `${payload.results.length} result(s) · ${payload.meta.promptsEnabled} enabled prompt(s) · all words required · name and keywords only`;

    if (payload.results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching enabled reusable prompt was found.";
      elements.promptSearchResults.append(empty);
      return;
    }

    for (const result of payload.results) {
      const article = document.createElement("article");
      article.className = "result tool-result";
      const badge = document.createElement("div");
      badge.className = "result-line tool-type";
      badge.textContent = "PROMPT";
      const body = document.createElement("div");
      const heading = document.createElement("strong");
      heading.className = "result-name";
      heading.textContent = result.name;
      const details = document.createElement("div");
      details.className = "result-path";
      details.textContent = `${result.lineCount} line(s) · ${result.characterCount} characters · matched ${result.matchedFields.join(" and ")}`;
      const preview = document.createElement("div");
      preview.className = "result-text";
      preview.textContent = result.preview;
      body.append(heading, details, preview);
      article.append(badge, body);
      elements.promptSearchResults.append(article);
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(elements.runPromptSearch, false);
  }
}

function activateTab(tabName, focus = false) {
  const selected = ["prompts", "documents", "tools", "secrets"].includes(tabName) ? tabName : "prompts";
  state.activeTab = selected;
  const tabs = {
    documents: { tab: elements.documentsTab, panel: elements.documentsPanel },
    tools: { tab: elements.toolsTab, panel: elements.toolsPanel },
    prompts: { tab: elements.promptsTab, panel: elements.promptsPanel },
    secrets: { tab: elements.secretsTab, panel: elements.secretsPanel }
  };
  for (const [name, item] of Object.entries(tabs)) {
    const active = name === selected;
    item.tab.classList.toggle("is-active", active);
    item.tab.setAttribute("aria-selected", String(active));
    item.tab.tabIndex = active ? 0 : -1;
    item.panel.hidden = !active;
  }
  if (focus) {
    tabs[selected].tab.focus();
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
  elements.maxMatchesPerFile,
  elements.maxFiles,
  elements.timeoutMs,
  elements.maxLineChars,
  elements.maxFileBytes,
  elements.toolExtensions
]) {
  attachConfigurationInput(input);
}

elements.ignoreFile.addEventListener("input", () => {
  setIgnoreFilePathState(
    elements.ignoreFile.value.trim() ? "Not validated · path changed" : "Optional path is not configured.",
    elements.ignoreFile.value.trim() ? "pending" : "idle"
  );
});
elements.ignoreFile.addEventListener("blur", () => {
  const target = ignoreFileValidationTarget();
  if (target) {
    validatePathTargets([target]);
  }
});

elements.addFolder.addEventListener("click", () => {
  const row = appendRoot({ name: `allowed-folder-${elements.rootsList.children.length + 1}`, path: "", priority: 100 });
  row.querySelector('[data-field="path"]').focus();
  markDirty();
});
elements.addFile.addEventListener("click", () => {
  const name = uniqueDocumentFileName(`document-file-${elements.filesList.children.length + 1}`);
  const row = appendFile({ name, path: "" });
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
elements.addSecretFile.addEventListener("click", () => {
  const name = uniqueSecretName(`secret-file-${elements.secretFilesList.children.length + 1}`);
  const row = appendSecretFile({ name, path: "", format: "auto" });
  row.querySelector('[data-field="path"]').focus();
  markDirty();
});
elements.addPrompt.addEventListener("click", () => {
  const name = uniquePromptName(`reusable-prompt-${elements.promptsList.children.length + 1}`);
  const row = appendPrompt({ name, content: "", enabled: true });
  row.querySelector('[data-field="name"]').select();
  markDirty();
});
elements.pickFolder.addEventListener("click", () => pickPath("directory"));
elements.pickFile.addEventListener("click", () => pickPath("file"));
elements.pickToolFolder.addEventListener("click", () => pickPath("directory", "tools"));
elements.pickToolFile.addEventListener("click", () => pickPath("file", "tools"));
elements.pickSecretFile.addEventListener("click", () => pickPath("secret-file", "secrets"));
elements.openDropBox.addEventListener("click", () => openNativeDropBox("documents"));
elements.toolOpenDropBox.addEventListener("click", () => openNativeDropBox("tools"));
elements.secretOpenDropBox.addEventListener("click", () => openNativeDropBox("secrets"));
wireDropZone(elements.dropZone, "documents");
wireDropZone(elements.toolDropZone, "tools");
wireDropZone(elements.secretDropZone, "secrets");
elements.reloadConfig.addEventListener("click", () => {
  if (!state.dirty || window.confirm("Discard unsaved changes and reload the saved configuration?")) {
    loadConfig();
  }
});
elements.validatePaths.addEventListener("click", validateAllPaths);
elements.saveConfig.addEventListener("click", saveConfig);
elements.searchForm.addEventListener("submit", runSearch);
elements.toolSearchForm.addEventListener("submit", runToolSearch);
elements.promptSearchForm.addEventListener("submit", runPromptSearch);
elements.secretSearchForm.addEventListener("submit", runSecretSearch);
elements.documentsTab.addEventListener("click", () => activateTab("documents"));
elements.toolsTab.addEventListener("click", () => activateTab("tools"));
elements.promptsTab.addEventListener("click", () => activateTab("prompts"));
elements.secretsTab.addEventListener("click", () => activateTab("secrets"));
const tabOrder = ["prompts", "documents", "tools", "secrets"];
const tabElements = [elements.promptsTab, elements.documentsTab, elements.toolsTab, elements.secretsTab];
for (const [index, tab] of tabElements.entries()) {
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    let nextIndex;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabOrder.length - 1;
    } else if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % tabOrder.length;
    } else {
      nextIndex = (index - 1 + tabOrder.length) % tabOrder.length;
    }
    const nextTab = tabOrder[nextIndex];
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
  elements.pickSecretFile.hidden = true;
  elements.secretOpenDropBox.hidden = true;
  elements.dropHelp.textContent = "Drop files or folders directly when your browser exposes complete local paths.";
  elements.toolDropHelp.textContent = "Drop tool folders or files directly when your browser exposes complete local paths.";
  elements.secretDropHelp.textContent = "Drop exact secret files directly when your browser exposes complete local paths.";
}

window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
  }
});

elements.configPath.textContent = runtime.configPath;
activateTab("prompts");
loadConfig();
