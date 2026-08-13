const runtime = window.AGENT_DOC_UI;

if (!runtime?.token) {
  throw new Error("The configuration UI did not receive a local session token.");
}

const elements = {
  configPath: document.querySelector("#config-path"),
  pageStatus: document.querySelector("#page-status"),
  actionbar: document.querySelector("#actionbar"),
  documentsInstruction: document.querySelector("#documents-instruction"),
  toolsInstruction: document.querySelector("#tools-instruction"),
  promptsInstruction: document.querySelector("#prompts-instruction"),
  secretsInstruction: document.querySelector("#secrets-instruction"),
  documentsInstructionSummary: document.querySelector("#documents-instruction-summary"),
  toolsInstructionSummary: document.querySelector("#tools-instruction-summary"),
  promptsInstructionSummary: document.querySelector("#prompts-instruction-summary"),
  secretsInstructionSummary: document.querySelector("#secrets-instruction-summary"),
  documentsTab: document.querySelector("#documents-tab"),
  toolsTab: document.querySelector("#tools-tab"),
  promptsTab: document.querySelector("#prompts-tab"),
  secretsTab: document.querySelector("#secrets-tab"),
  helpTab: document.querySelector("#help-tab"),
  documentsPanel: document.querySelector("#documents-panel"),
  toolsPanel: document.querySelector("#tools-panel"),
  promptsPanel: document.querySelector("#prompts-panel"),
  secretsPanel: document.querySelector("#secrets-panel"),
  helpPanel: document.querySelector("#help-panel"),
  rootsList: document.querySelector("#document-grants-list"),
  rootsEmpty: document.querySelector("#document-grants-empty"),
  filesList: document.querySelector("#document-grants-list"),
  filesEmpty: document.querySelector("#document-grants-empty"),
  rootTemplate: document.querySelector("#root-row-template"),
  fileTemplate: document.querySelector("#file-row-template"),
  documentGrantList: document.querySelector("#document-grants-list"),
  documentGrantsEmpty: document.querySelector("#document-grants-empty"),
  documentGrantsFilterEmpty: document.querySelector("#document-grants-filter-empty"),
  documentGrantCount: document.querySelector("#document-grant-count"),
  documentGrantEnabledCount: document.querySelector("#document-grant-enabled-count"),
  documentGrantFilter: document.querySelector("#document-grant-filter"),
  documentGrantTypeFilter: document.querySelector("#document-grant-type-filter"),
  documentGrantStatusFilter: document.querySelector("#document-grant-status-filter"),
  documentGrantInspector: document.querySelector("#document-grant-inspector"),
  documentGrantInspectorEmpty: document.querySelector("#document-grant-inspector-empty"),
  documentGrantInspectorBody: document.querySelector("#document-grant-inspector-body"),
  documentEditorTitle: document.querySelector("#document-editor-title"),
  documentEditorMeta: document.querySelector("#document-editor-meta"),
  documentEditorKind: document.querySelector("#document-editor-kind"),
  documentEditorName: document.querySelector("#document-editor-name"),
  documentEditorPath: document.querySelector("#document-editor-path"),
  documentEditorPriority: document.querySelector("#document-editor-priority"),
  documentEditorPriorityField: document.querySelector("#document-editor-priority-field"),
  documentEditorEnabled: document.querySelector("#document-editor-enabled"),
  documentEditorPathState: document.querySelector("#document-editor-path-state"),
  documentEditorScope: document.querySelector("#document-editor-scope"),
  deleteDocumentGrant: document.querySelector("#delete-document-grant"),
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
  changeSummary: document.querySelector("#change-summary"),
  searchForm: document.querySelector("#search-form"),
  searchQuery: document.querySelector("#search-query"),
  runSearch: document.querySelector("#run-search"),
  searchSummary: document.querySelector("#search-summary"),
  searchResults: document.querySelector("#search-results"),
  toolDirectoriesList: document.querySelector("#tool-directories-list"),
  toolDirectoriesEmpty: document.querySelector("#tool-directories-empty"),
  toolSourcesFilterEmpty: document.querySelector("#tool-sources-filter-empty"),
  toolSourceCount: document.querySelector("#tool-source-count"),
  toolSourceEnabledCount: document.querySelector("#tool-source-enabled-count"),
  toolSourceFilter: document.querySelector("#tool-source-filter"),
  toolSourceStatusFilter: document.querySelector("#tool-source-status-filter"),
  toolSourceInspector: document.querySelector("#tool-source-inspector"),
  toolSourceInspectorEmpty: document.querySelector("#tool-source-inspector-empty"),
  toolSourceInspectorBody: document.querySelector("#tool-source-inspector-body"),
  toolSourceEditorTitle: document.querySelector("#tool-source-editor-title"),
  toolSourceEditorMeta: document.querySelector("#tool-source-editor-meta"),
  toolSourceEditorName: document.querySelector("#tool-source-editor-name"),
  toolSourceEditorPath: document.querySelector("#tool-source-editor-path"),
  toolSourceEditorPriority: document.querySelector("#tool-source-editor-priority"),
  toolSourceEditorIncludeDocs: document.querySelector("#tool-source-editor-include-docs"),
  toolSourceEditorEnabled: document.querySelector("#tool-source-editor-enabled"),
  toolSourceEditorPathState: document.querySelector("#tool-source-editor-path-state"),
  toolSourceEditorInstruction: document.querySelector("#tool-source-editor-instruction"),
  toolSourceOverviewTab: document.querySelector("#tool-source-overview-tab"),
  toolSourceToolsTab: document.querySelector("#tool-source-tools-tab"),
  toolSourceDocumentsTab: document.querySelector("#tool-source-documents-tab"),
  toolSourceInstructionTab: document.querySelector("#tool-source-instruction-tab"),
  toolSourceOverview: document.querySelector("#tool-source-overview"),
  toolSourceResourceGrants: document.querySelector("#tool-source-resource-grants"),
  toolSourceInstruction: document.querySelector("#tool-source-instruction"),
  toolSourceToolsTabCount: document.querySelector("#tool-source-tools-tab-count"),
  toolSourceDocumentsTabCount: document.querySelector("#tool-source-documents-tab-count"),
  deleteToolSource: document.querySelector("#delete-tool-source"),
  toolSourceScanTool: document.querySelector("#tool-source-scan-tool"),
  toolSourceScanDocument: document.querySelector("#tool-source-scan-document"),
  toolSourceScanRecursive: document.querySelector("#tool-source-scan-recursive"),
  toolSourceScanRecursiveHelp: document.querySelector("#tool-source-scan-recursive-help"),
  toolGrantSectionStep: document.querySelector("#tool-grant-section-step"),
  toolGrantSectionTitle: document.querySelector("#tool-grant-section-title"),
  toolGrantSectionDescription: document.querySelector("#tool-grant-section-description"),
  toolGrantFilter: document.querySelector("#tool-grant-filter"),
  toolGrantStatusFilter: document.querySelector("#tool-grant-status-filter"),
  toolGrantsList: document.querySelector("#tool-grants-list"),
  toolGrantsEmpty: document.querySelector("#tool-grants-empty"),
  toolGrantsFilterEmpty: document.querySelector("#tool-grants-filter-empty"),
  enableVisibleToolGrants: document.querySelector("#enable-visible-tool-grants"),
  disableVisibleToolGrants: document.querySelector("#disable-visible-tool-grants"),
  toolGrantEditor: document.querySelector("#tool-grant-editor"),
  toolGrantEditorTitle: document.querySelector("#tool-grant-editor-title"),
  toolGrantEditorName: document.querySelector("#tool-grant-editor-name"),
  toolGrantEditorPriorityField: document.querySelector("#tool-grant-editor-priority-field"),
  toolGrantEditorPriority: document.querySelector("#tool-grant-editor-priority"),
  toolGrantEditorPath: document.querySelector("#tool-grant-editor-path"),
  toolGrantEditorEnabled: document.querySelector("#tool-grant-editor-enabled"),
  copyToolGrantPath: document.querySelector("#copy-tool-grant-path"),
  deleteToolGrant: document.querySelector("#delete-tool-grant"),
  toolFilesList: document.querySelector("#tool-files-list"),
  toolFilesEmpty: document.querySelector("#tool-files-empty"),
  toolExactGrants: document.querySelector("#tool-exact-grants"),
  toolExactCount: document.querySelector("#tool-exact-count"),
  toolExactEditor: document.querySelector("#tool-exact-editor"),
  toolExactEditorEmpty: document.querySelector("#tool-exact-editor-empty"),
  toolExactEditorBody: document.querySelector("#tool-exact-editor-body"),
  toolExactEditorTitle: document.querySelector("#tool-exact-editor-title"),
  toolExactEditorName: document.querySelector("#tool-exact-editor-name"),
  toolExactEditorPath: document.querySelector("#tool-exact-editor-path"),
  toolExactEditorPriority: document.querySelector("#tool-exact-editor-priority"),
  toolExactEditorEnabled: document.querySelector("#tool-exact-editor-enabled"),
  toolExactEditorPathState: document.querySelector("#tool-exact-editor-path-state"),
  deleteToolExact: document.querySelector("#delete-tool-exact"),
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
  promptsFilterEmpty: document.querySelector("#prompts-filter-empty"),
  promptsCount: document.querySelector("#prompts-count"),
  promptTemplate: document.querySelector("#prompt-row-template"),
  addPrompt: document.querySelector("#add-prompt"),
  promptCatalogFilter: document.querySelector("#prompt-catalog-filter"),
  promptStatusFilter: document.querySelector("#prompt-status-filter"),
  promptEditorPanel: document.querySelector("#prompt-editor-panel"),
  promptEditorEmpty: document.querySelector("#prompt-editor-empty"),
  promptEditorBody: document.querySelector("#prompt-editor-body"),
  promptEditorTitle: document.querySelector("#prompt-editor-title"),
  promptEditorMeta: document.querySelector("#prompt-editor-meta"),
  promptEditorName: document.querySelector("#prompt-editor-name"),
  promptEditorKeywords: document.querySelector("#prompt-editor-keywords"),
  promptEditorContent: document.querySelector("#prompt-editor-content"),
  promptEditorEnabled: document.querySelector("#prompt-editor-enabled"),
  focusPromptEditor: document.querySelector("#focus-prompt-editor"),
  duplicatePrompt: document.querySelector("#duplicate-prompt"),
  deletePrompt: document.querySelector("#delete-prompt"),
  promptSearchForm: document.querySelector("#prompt-search-form"),
  promptSearchQuery: document.querySelector("#prompt-search-query"),
  runPromptSearch: document.querySelector("#run-prompt-search"),
  promptSearchSummary: document.querySelector("#prompt-search-summary"),
  promptSearchResults: document.querySelector("#prompt-search-results"),
  secretFilesList: document.querySelector("#secret-files-list"),
  secretFilesEmpty: document.querySelector("#secret-files-empty"),
  secretFilesFilterEmpty: document.querySelector("#secret-files-filter-empty"),
  secretCount: document.querySelector("#secret-count"),
  secretEnabledCount: document.querySelector("#secret-enabled-count"),
  secretCatalogFilter: document.querySelector("#secret-catalog-filter"),
  secretStatusFilter: document.querySelector("#secret-status-filter"),
  secretInspector: document.querySelector("#secret-inspector"),
  secretInspectorEmpty: document.querySelector("#secret-inspector-empty"),
  secretInspectorBody: document.querySelector("#secret-inspector-body"),
  secretEditorTitle: document.querySelector("#secret-editor-title"),
  secretEditorMeta: document.querySelector("#secret-editor-meta"),
  secretEditorName: document.querySelector("#secret-editor-name"),
  secretEditorPath: document.querySelector("#secret-editor-path"),
  secretEditorFormat: document.querySelector("#secret-editor-format"),
  secretEditorPathState: document.querySelector("#secret-editor-path-state"),
  secretEditorEnabled: document.querySelector("#secret-editor-enabled"),
  deleteSecretFile: document.querySelector("#delete-secret-file"),
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
  saving: false,
  changeVersion: 0,
  toastTimer: null,
  pathValidationCounter: 0,
  folderScanResults: new Map(),
  selectedPromptId: null,
  promptRowCounter: 0,
  promptFocusMode: false,
  selectedToolSourceId: null,
  toolSourceRowCounter: 0,
  activeToolSourceSection: "overview",
  selectedToolGrantId: null,
  selectedToolExactId: null,
  toolExactRowCounter: 0,
  selectedDocumentGrantId: null,
  documentGrantRowCounter: 0,
  selectedSecretId: null,
  secretRowCounter: 0
};

let activeWorkspaceSplitter = null;

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
  button.setAttribute("aria-busy", String(busy));
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

function showDirtyState() {
  elements.dirtyState.textContent = "Unsaved changes";
  elements.changeSummary.textContent = "Save to make these changes available to the agent. Ctrl+S saves.";
  elements.dirtyState.classList.add("is-dirty");
  elements.saveConfig.classList.add("is-dirty");
  elements.actionbar.classList.add("has-unsaved-changes");
  elements.saveConfig.disabled = state.saving;
}

function markDirty() {
  if (!state.config) {
    return;
  }
  state.changeVersion += 1;
  state.dirty = true;
  showDirtyState();
}

function markClean() {
  state.dirty = false;
  elements.dirtyState.textContent = "No unsaved changes";
  elements.changeSummary.textContent = "Saved configuration is available to the local agent.";
  elements.dirtyState.classList.remove("is-dirty");
  elements.saveConfig.classList.remove("is-dirty");
  elements.actionbar.classList.remove("has-unsaved-changes");
  elements.saveConfig.disabled = state.saving;
}

function showSavingState() {
  elements.dirtyState.textContent = "Saving changes…";
  elements.changeSummary.textContent = "You can keep working. This view will stay in place while the save finishes.";
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
  return uniqueDocumentGrantName("directory", baseName);
}

function uniqueDocumentFileName(baseName) {
  return uniqueDocumentGrantName("file", baseName);
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
  state.documentGrantRowCounter += 1;
  row.dataset.documentGrantId = `document-grant-${state.documentGrantRowCounter}`;
  row.dataset.documentKind = "directory";
  nameInput.value = normalized.name ?? friendlyPathName(normalized.path ?? "", "allowed-folder");
  pathInput.value = normalized.path ?? "";
  priorityInput.value = normalized.priority ?? 0;
  applyEntryAvailability(row, pathState, availability, "directory");
  initializeEntryToggle(row, pathState, entryEnabled(normalized));
  initializePathValidation(row, pathState, pathInput, "directory");

  for (const input of row.querySelectorAll("input")) {
    attachConfigurationInput(input);
  }
  row.querySelector('[data-field="enabled"]').addEventListener("change", () => {
    updateDocumentGrantEntrySummary(row);
    updateDocumentGrantCatalog();
    if (row.dataset.documentGrantId === state.selectedDocumentGrantId) {
      updateDocumentGrantInspectorHeader(row);
    }
  });
  row.querySelector('[data-action="select-document-grant"]').addEventListener("click", () => selectDocumentGrant(row));
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    const nextRow = row.nextElementSibling ?? row.previousElementSibling;
    const wasSelected = row.dataset.documentGrantId === state.selectedDocumentGrantId;
    row.remove();
    if (wasSelected) {
      state.selectedDocumentGrantId = nextRow?.dataset.documentGrantId ?? null;
    }
    updateEmptyStates();
    refreshDocumentGrantInspector();
    markDirty();
  });

  elements.documentGrantList.append(row);
  updateDocumentGrantEntrySummary(row);
  updateEmptyStates();
  return row;
}

function appendFile(file = {}, availability = undefined) {
  const fragment = elements.fileTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const pathState = row.querySelector('[data-role="state"]');
  state.documentGrantRowCounter += 1;
  row.dataset.documentGrantId = `document-grant-${state.documentGrantRowCounter}`;
  row.dataset.documentKind = "file";
  nameInput.value = file.name ?? "";
  pathInput.value = file.path ?? "";
  applyEntryAvailability(row, pathState, availability, "file");
  initializeEntryToggle(row, pathState, entryEnabled(file));
  initializePathValidation(row, pathState, pathInput, "file");

  for (const input of row.querySelectorAll("input")) {
    attachConfigurationInput(input);
  }
  row.querySelector('[data-field="enabled"]').addEventListener("change", () => {
    updateDocumentGrantEntrySummary(row);
    updateDocumentGrantCatalog();
    if (row.dataset.documentGrantId === state.selectedDocumentGrantId) {
      updateDocumentGrantInspectorHeader(row);
    }
  });
  row.querySelector('[data-action="select-document-grant"]').addEventListener("click", () => selectDocumentGrant(row));
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    const nextRow = row.nextElementSibling ?? row.previousElementSibling;
    const wasSelected = row.dataset.documentGrantId === state.selectedDocumentGrantId;
    row.remove();
    if (wasSelected) {
      state.selectedDocumentGrantId = nextRow?.dataset.documentGrantId ?? null;
    }
    updateEmptyStates();
    refreshDocumentGrantInspector();
    markDirty();
  });

  elements.documentGrantList.append(row);
  updateDocumentGrantEntrySummary(row);
  updateEmptyStates();
  return row;
}

function compactLocalPath(value) {
  const normalized = value.trim().replaceAll("/", "\\");
  const parts = normalized.split("\\").filter(Boolean);
  if (parts.length <= 3) {
    return normalized || "No path configured";
  }
  return `…\\${parts.slice(-3).join("\\")}`;
}

function matchesOperatorFilter(value, query) {
  const terms = query
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) {
    return true;
  }
  const searchable = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
  return terms.every((term) => searchable.includes(term));
}

function documentGrantRows() {
  return [...elements.documentGrantList.querySelectorAll(".document-grant-entry")];
}

function documentGrantRowsByKind(kind) {
  return documentGrantRows().filter((row) => row.dataset.documentKind === kind);
}

function documentGrantRowById(grantId = state.selectedDocumentGrantId) {
  if (!grantId) {
    return null;
  }
  return documentGrantRows().find((row) => row.dataset.documentGrantId === grantId) ?? null;
}

function uniqueDocumentGrantName(kind, baseName) {
  const names = new Set(documentGrantRowsByKind(kind)
    .map((row) => row.querySelector('[data-field="name"]').value.trim().toLowerCase())
    .filter(Boolean));
  return uniqueNameFromSet(baseName, names);
}

function documentGrantKindLabel(kind) {
  return kind === "directory" ? "Folder root" : "Exact file";
}

function documentGrantStatusText(row) {
  const stateText = row.querySelector('[data-role="state"]')?.textContent?.trim();
  return stateText || "Not validated";
}

function updateDocumentGrantEntrySummary(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const documentPath = row.querySelector('[data-field="path"]').value.trim();
  const kind = row.dataset.documentKind;
  const enabled = row.querySelector('[data-field="enabled"]').checked;
  const pathState = row.querySelector('[data-role="state"]');
  const selection = row.querySelector('[data-action="select-document-grant"]');

  row.querySelector('[data-role="document-grant-name"]').textContent = name || "Untitled document grant";
  row.querySelector('[data-role="document-grant-kind"]').textContent = kind === "directory" ? "Folder" : "Exact";
  row.querySelector('[data-role="document-grant-kind"]').className = `document-grant-kind is-${kind}`;
  row.querySelector('[data-role="document-grant-path"]').textContent = compactLocalPath(documentPath);
  row.querySelector('[data-role="document-grant-path"]').title = documentPath;
  row.querySelector('[data-role="document-grant-validation"]').textContent = documentGrantStatusText(row);
  row.querySelector('[data-role="document-grant-validation"]').dataset.validationStatus = pathState?.dataset.activeStatus ?? "idle";
  selection.setAttribute("aria-label", `Edit ${documentGrantKindLabel(kind).toLocaleLowerCase()} ${name || "untitled document grant"}`);
  row.dataset.documentGrantSearch = `${name}\n${documentPath}\n${documentGrantKindLabel(kind)}`.toLocaleLowerCase();
  row.classList.toggle("is-empty-path", !documentPath);
  row.classList.toggle("is-disabled", !enabled);
}

function updateDocumentGrantInspectorHeader(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const kind = row.dataset.documentKind;
  const enabled = row.querySelector('[data-field="enabled"]').checked;
  const pathState = row.querySelector('[data-role="state"]');
  elements.documentEditorTitle.textContent = name || "Untitled document grant";
  elements.documentEditorMeta.textContent = `${documentGrantKindLabel(kind)} · ${enabled ? "Enabled" : "Disabled"}`;
  elements.documentEditorKind.textContent = documentGrantKindLabel(kind);
  elements.documentEditorKind.className = `document-editor-kind is-${kind}`;
  elements.documentEditorPathState.textContent = documentGrantStatusText(row);
  elements.documentEditorPathState.dataset.validationStatus = pathState?.dataset.activeStatus ?? "idle";
  elements.documentEditorScope.textContent = kind === "directory"
    ? "Folder root: document matching rules apply recursively beneath this directory."
    : "Exact file: this grant remains available independently of folder roots and matching rules.";
}

function refreshDocumentGrantInspector() {
  const selectedRow = documentGrantRowById();
  elements.documentGrantInspectorEmpty.hidden = Boolean(selectedRow);
  elements.documentGrantInspectorBody.hidden = !selectedRow;
  elements.documentGrantInspector.classList.toggle("has-selection", Boolean(selectedRow));

  for (const row of documentGrantRows()) {
    const selected = row === selectedRow;
    row.classList.toggle("is-selected", selected);
    row.querySelector('[data-action="select-document-grant"]').setAttribute("aria-pressed", String(selected));
  }

  if (!selectedRow) {
    return;
  }

  const kind = selectedRow.dataset.documentKind;
  elements.documentEditorName.value = selectedRow.querySelector('[data-field="name"]').value;
  elements.documentEditorPath.value = selectedRow.querySelector('[data-field="path"]').value;
  elements.documentEditorPriority.value = kind === "directory"
    ? selectedRow.querySelector('[data-field="priority"]').value
    : "";
  elements.documentEditorPriorityField.hidden = kind !== "directory";
  elements.documentEditorPriority.required = kind === "directory";
  elements.documentEditorPriorityField.parentElement?.classList.toggle("is-single-field", kind !== "directory");
  elements.documentEditorEnabled.checked = selectedRow.querySelector('[data-field="enabled"]').checked;
  updateDocumentGrantInspectorHeader(selectedRow);
}

function selectDocumentGrant(row, { focus = false } = {}) {
  state.selectedDocumentGrantId = row?.dataset.documentGrantId ?? null;
  refreshDocumentGrantInspector();
  if (focus && row) {
    elements.documentEditorName.focus();
    elements.documentEditorName.select();
  }
}

function updateDocumentGrantCatalog() {
  const query = elements.documentGrantFilter.value.trim().toLocaleLowerCase();
  const type = elements.documentGrantTypeFilter.value;
  const status = elements.documentGrantStatusFilter.value;
  const rows = documentGrantRows();
  let visibleCount = 0;
  let enabledCount = 0;

  for (const row of rows) {
    updateDocumentGrantEntrySummary(row);
    const enabled = row.querySelector('[data-field="enabled"]').checked;
    const matchesText = matchesOperatorFilter(row.dataset.documentGrantSearch, query);
    const matchesType = type === "all" || type === row.dataset.documentKind;
    const matchesStatus = status === "all" || (status === "enabled" ? enabled : !enabled);
    row.hidden = !matchesText || !matchesType || !matchesStatus;
    if (!row.hidden) {
      visibleCount += 1;
    }
    if (enabled) {
      enabledCount += 1;
    }
  }

  const total = rows.length;
  const label = total === 1 ? "1 grant" : `${total} grants`;
  elements.documentGrantCount.textContent = visibleCount === total ? label : `${visibleCount}/${total} shown`;
  elements.documentGrantEnabledCount.textContent = `${enabledCount} enabled`;
  elements.documentGrantsEmpty.hidden = total > 0;
  elements.documentGrantsFilterEmpty.hidden = total === 0 || visibleCount > 0;

  const selectedRow = documentGrantRowById();
  if (!selectedRow || selectedRow.hidden) {
    state.selectedDocumentGrantId = rows.find((row) => !row.hidden)?.dataset.documentGrantId ?? null;
    refreshDocumentGrantInspector();
  }
}

function syncDocumentGrantEditor() {
  const row = documentGrantRowById();
  if (!row) {
    return;
  }
  const kind = row.dataset.documentKind;
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const enabledInput = row.querySelector('[data-field="enabled"]');
  const pathState = row.querySelector('[data-role="state"]');
  const nextPath = elements.documentEditorPath.value;
  const changedPath = pathInput.value !== nextPath;

  nameInput.value = elements.documentEditorName.value;
  pathInput.value = nextPath;
  if (kind === "directory") {
    row.querySelector('[data-field="priority"]').value = elements.documentEditorPriority.value;
  }
  enabledInput.checked = elements.documentEditorEnabled.checked;
  if (changedPath) {
    setEntryPathState(
      row,
      pathState,
      nextPath.trim() ? "Not validated · path changed" : `${kind === "directory" ? "Directory" : "File"} path is required`,
      nextPath.trim() ? "pending" : "invalid"
    );
  }
  refreshEntryEnabledState(row, pathState);
  updateDocumentGrantEntrySummary(row);
  updateDocumentGrantInspectorHeader(row);
  updateDocumentGrantCatalog();
  markDirty();
}

function toolSourceRows() {
  return [...elements.toolDirectoriesList.querySelectorAll(".tool-source-entry")];
}

function toolExactRows() {
  return [...elements.toolFilesList.querySelectorAll(".tool-exact-entry")];
}

function toolSourceRowById(sourceId = state.selectedToolSourceId) {
  if (!sourceId) {
    return null;
  }
  return toolSourceRows().find((row) => row.dataset.toolSourceId === sourceId) ?? null;
}

function toolExactRowById(exactId = state.selectedToolExactId) {
  if (!exactId) {
    return null;
  }
  return toolExactRows().find((row) => row.dataset.toolExactId === exactId) ?? null;
}

function sourceScanEntries(row, kind) {
  if (!row) {
    return [];
  }
  return state.folderScanResults.get(row.dataset.folderScanKey)?.[kind]?.entries ?? [];
}

function sourceGrantCounts(row) {
  const tools = sourceScanEntries(row, "tool");
  const documents = sourceScanEntries(row, "document");
  const entries = [...tools, ...documents];
  return {
    tools: tools.length,
    documents: documents.length,
    total: entries.length,
    enabled: entries.filter((entry) => entry.enabled !== false).length
  };
}

function toolSourceStatusText(row) {
  const stateText = row.querySelector('[data-role="state"]')?.textContent?.trim();
  return stateText || "Not validated";
}

function updateToolSourceEntrySummary(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const sourcePath = row.querySelector('[data-field="path"]').value.trim();
  const toolRecursive = row.querySelector('[data-field="recursive"]').checked;
  const documentRecursive = row.querySelector('[data-field="documentRecursive"]').checked;
  const includeDocs = row.querySelector('[data-field="includeDocs"]').checked;
  const enabled = row.querySelector('[data-field="enabled"]').checked;
  const counts = sourceGrantCounts(row);
  const selection = row.querySelector('[data-action="select-source"]');
  const pathState = row.querySelector('[data-role="state"]');

  row.querySelector('[data-role="tool-source-name"]').textContent = name || "Untitled source";
  row.querySelector('[data-role="tool-source-path"]').textContent = compactLocalPath(sourcePath);
  row.querySelector('[data-role="tool-source-path"]').title = sourcePath;
  row.querySelector('[data-role="tool-source-meta"]').textContent = `${counts.tools} tool${counts.tools === 1 ? "" : "s"} · ${counts.documents} doc${counts.documents === 1 ? "" : "s"} · tools ${toolRecursive ? "deep" : "top"} · docs ${documentRecursive ? "deep" : "top"}${includeDocs ? " · docs on" : ""}`;
  row.querySelector('[data-role="tool-source-validation"]').textContent = toolSourceStatusText(row);
  row.querySelector('[data-role="tool-source-validation"]').dataset.validationStatus = pathState?.dataset.activeStatus ?? "idle";
  selection.setAttribute("aria-label", `Edit tool source ${name || "untitled source"}`);
  row.dataset.toolSourceSearch = `${name}\n${sourcePath}`.toLocaleLowerCase();
  row.classList.toggle("is-empty-path", !sourcePath);
  row.classList.toggle("is-disabled", !enabled);
}

function updateToolExactEntrySummary(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const filePath = row.querySelector('[data-field="path"]').value.trim();
  const priority = row.querySelector('[data-field="priority"]').value;
  const enabled = row.querySelector('[data-field="enabled"]').checked;
  const selection = row.querySelector('[data-action="select-exact-tool"]');

  row.querySelector('[data-role="tool-exact-name"]').textContent = name || "Untitled exact tool";
  row.querySelector('[data-role="tool-exact-path"]').textContent = compactLocalPath(filePath);
  row.querySelector('[data-role="tool-exact-path"]').title = filePath;
  row.querySelector('[data-role="tool-exact-meta"]').textContent = `Priority ${priority || "—"} · ${toolSourceStatusText(row)}`;
  selection.setAttribute("aria-label", `Edit exact tool ${name || "untitled exact tool"}`);
  row.classList.toggle("is-disabled", !enabled);
}

function updateToolSourceInspectorHeader(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const counts = sourceGrantCounts(row);
  const pathState = row.querySelector('[data-role="state"]');
  elements.toolSourceEditorTitle.textContent = name || "Untitled source";
  elements.toolSourceEditorMeta.textContent = `${counts.total} saved grant${counts.total === 1 ? "" : "s"} · ${counts.enabled} enabled`;
  elements.toolSourceToolsTabCount.textContent = String(counts.tools);
  elements.toolSourceDocumentsTabCount.textContent = String(counts.documents);
  elements.toolSourceEditorPathState.textContent = toolSourceStatusText(row);
  elements.toolSourceEditorPathState.dataset.validationStatus = pathState?.dataset.activeStatus ?? "idle";
}

function activeToolGrantKind() {
  return state.activeToolSourceSection === "documents" ? "document" : "tool";
}

function updateToolGrantSection(kind = activeToolGrantKind()) {
  const isDocument = kind === "document";
  const label = isDocument ? "Documents" : "Tools";
  const singular = isDocument ? "document" : "tool";
  const tab = isDocument ? elements.toolSourceDocumentsTab : elements.toolSourceToolsTab;
  const source = toolSourceRowById();
  const recursiveField = isDocument ? "documentRecursive" : "recursive";

  elements.toolSourceResourceGrants.dataset.grantKind = kind;
  elements.toolSourceResourceGrants.setAttribute("aria-labelledby", tab.id);
  elements.toolGrantSectionStep.textContent = isDocument ? "DOCUMENT SCANS" : "TOOL SCANS";
  elements.toolGrantSectionTitle.textContent = `${label} grants`;
  elements.toolGrantSectionDescription.textContent = isDocument
    ? "Review matching documentation files from this source."
    : "Review matching executable and script files from this source.";
  elements.toolGrantFilter.placeholder = `Filter ${singular}s`;
  elements.toolGrantsEmpty.textContent = `No saved ${singular} grants exist for this source. Run Scan ${singular}s to review matching files.`;
  elements.toolGrantsFilterEmpty.textContent = `No saved ${singular} grants match this filter.`;
  elements.enableVisibleToolGrants.textContent = `Enable visible ${singular}s`;
  elements.disableVisibleToolGrants.textContent = `Disable visible ${singular}s`;
  elements.toolSourceScanTool.hidden = isDocument;
  elements.toolSourceScanDocument.hidden = !isDocument;
  elements.toolSourceScanRecursive.checked = source?.querySelector(`[data-field="${recursiveField}"]`)?.checked ?? true;
  elements.toolSourceScanRecursive.setAttribute("aria-label", `Include subfolders when scanning ${singular}s`);
  elements.toolSourceScanRecursiveHelp.textContent = isDocument
    ? "Scan nested documents only. It does not broaden documentation discovery."
    : "Scan nested tool files. This also controls recursive tool discovery.";
}

function setToolSourceSection(section, focus = false) {
  const selected = ["overview", "tools", "documents", "instruction"].includes(section) ? section : "overview";
  state.activeToolSourceSection = selected;
  const sections = {
    overview: { tab: elements.toolSourceOverviewTab, panel: elements.toolSourceOverview },
    tools: { tab: elements.toolSourceToolsTab, panel: elements.toolSourceResourceGrants },
    documents: { tab: elements.toolSourceDocumentsTab, panel: elements.toolSourceResourceGrants },
    instruction: { tab: elements.toolSourceInstructionTab, panel: elements.toolSourceInstruction }
  };
  for (const [name, item] of Object.entries(sections)) {
    const active = name === selected;
    item.tab.classList.toggle("is-active", active);
    item.tab.setAttribute("aria-selected", String(active));
    item.tab.tabIndex = active ? 0 : -1;
  }
  elements.toolSourceOverview.hidden = selected !== "overview";
  elements.toolSourceResourceGrants.hidden = !["tools", "documents"].includes(selected);
  elements.toolSourceInstruction.hidden = selected !== "instruction";
  if (selected === "tools" || selected === "documents") {
    updateToolGrantSection();
    renderToolSourceGrants();
  }
  if (focus) {
    sections[selected].tab.focus();
  }
}

function refreshToolSourceInspector() {
  const selectedRow = toolSourceRowById();
  elements.toolSourceInspectorEmpty.hidden = Boolean(selectedRow);
  elements.toolSourceInspectorBody.hidden = !selectedRow;
  elements.toolSourceInspector.classList.toggle("has-selection", Boolean(selectedRow));

  for (const row of toolSourceRows()) {
    const selected = row === selectedRow;
    row.classList.toggle("is-selected", selected);
    row.querySelector('[data-action="select-source"]').setAttribute("aria-pressed", String(selected));
  }

  if (!selectedRow) {
    return;
  }

  elements.toolSourceEditorName.value = selectedRow.querySelector('[data-field="name"]').value;
  elements.toolSourceEditorPath.value = selectedRow.querySelector('[data-field="path"]').value;
  elements.toolSourceEditorPriority.value = selectedRow.querySelector('[data-field="priority"]').value;
  elements.toolSourceEditorIncludeDocs.checked = selectedRow.querySelector('[data-field="includeDocs"]').checked;
  elements.toolSourceEditorEnabled.checked = selectedRow.querySelector('[data-field="enabled"]').checked;
  elements.toolSourceEditorInstruction.value = selectedRow.querySelector('[data-role="folder-instruction"]').value;
  updateToolSourceInspectorHeader(selectedRow);
  setToolSourceSection(state.activeToolSourceSection);
}

function selectToolSource(row, { focus = false, section = "overview" } = {}) {
  const changed = state.selectedToolSourceId !== row?.dataset.toolSourceId;
  state.selectedToolSourceId = row?.dataset.toolSourceId ?? null;
  if (changed) {
    state.selectedToolGrantId = null;
    state.activeToolSourceSection = section;
  }
  refreshToolSourceInspector();
  if (focus && row) {
    elements.toolSourceEditorName.focus();
    elements.toolSourceEditorName.select();
  }
}

function updateToolSourceCatalog() {
  const query = elements.toolSourceFilter.value.trim().toLocaleLowerCase();
  const status = elements.toolSourceStatusFilter.value;
  const rows = toolSourceRows();
  let visibleCount = 0;
  let enabledCount = 0;

  for (const row of rows) {
    updateToolSourceEntrySummary(row);
    const enabled = row.querySelector('[data-field="enabled"]').checked;
    const matchesText = matchesOperatorFilter(row.dataset.toolSourceSearch, query);
    const matchesStatus = status === "all" || (status === "enabled" ? enabled : !enabled);
    row.hidden = !matchesText || !matchesStatus;
    if (!row.hidden) {
      visibleCount += 1;
    }
    if (enabled) {
      enabledCount += 1;
    }
  }

  const total = rows.length;
  const label = total === 1 ? "1 source" : `${total} sources`;
  elements.toolSourceCount.textContent = visibleCount === total ? label : `${visibleCount}/${total} shown`;
  elements.toolSourceEnabledCount.textContent = `${enabledCount} enabled`;
  elements.toolDirectoriesEmpty.hidden = total > 0;
  elements.toolSourcesFilterEmpty.hidden = total === 0 || visibleCount > 0;

  const selectedRow = toolSourceRowById();
  if (selectedRow?.hidden) {
    state.selectedToolSourceId = rows.find((row) => !row.hidden)?.dataset.toolSourceId ?? null;
    state.selectedToolGrantId = null;
    refreshToolSourceInspector();
  }
}

function syncToolSourceEditor() {
  const row = toolSourceRowById();
  if (!row) {
    return;
  }
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const priorityInput = row.querySelector('[data-field="priority"]');
  const includeDocsInput = row.querySelector('[data-field="includeDocs"]');
  const enabledInput = row.querySelector('[data-field="enabled"]');
  const instructionInput = row.querySelector('[data-role="folder-instruction"]');
  const pathState = row.querySelector('[data-role="state"]');
  const previousKey = row.dataset.folderScanKey;
  const nextPath = elements.toolSourceEditorPath.value;

  nameInput.value = elements.toolSourceEditorName.value;
  pathInput.value = nextPath;
  priorityInput.value = elements.toolSourceEditorPriority.value;
  includeDocsInput.checked = elements.toolSourceEditorIncludeDocs.checked;
  enabledInput.checked = elements.toolSourceEditorEnabled.checked;
  instructionInput.value = elements.toolSourceEditorInstruction.value;

  const nextKey = folderScanKey(nextPath);
  if (previousKey !== nextKey) {
    state.folderScanResults.delete(previousKey);
    row.dataset.folderScanKey = nextKey;
    setEntryPathState(
      row,
      pathState,
      nextPath.trim() ? "Not validated · path changed" : "Directory path is required",
      nextPath.trim() ? "pending" : "invalid"
    );
    state.selectedToolGrantId = null;
  }
  refreshEntryEnabledState(row, pathState);
  updateToolSourceEntrySummary(row);
  updateToolSourceInspectorHeader(row);
  updateToolSourceCatalog();
  markDirty();
}

function syncToolSourceScanRecursive() {
  const row = toolSourceRowById();
  if (!row) {
    return;
  }
  const field = activeToolGrantKind() === "document" ? "documentRecursive" : "recursive";
  row.querySelector(`[data-field="${field}"]`).checked = elements.toolSourceScanRecursive.checked;
  updateToolSourceEntrySummary(row);
  updateToolSourceInspectorHeader(row);
  updateToolSourceCatalog();
  updateToolGrantSection();
  markDirty();
}

function selectToolExact(row, { focus = false } = {}) {
  state.selectedToolExactId = row?.dataset.toolExactId ?? null;
  refreshToolExactEditor();
  if (focus && row) {
    elements.toolExactEditorName.focus();
    elements.toolExactEditorName.select();
  }
}

function updateToolExactCatalog() {
  const rows = toolExactRows();
  let enabledCount = 0;
  for (const row of rows) {
    updateToolExactEntrySummary(row);
    if (row.querySelector('[data-field="enabled"]').checked) {
      enabledCount += 1;
    }
  }
  const total = rows.length;
  elements.toolExactCount.textContent = total === 1 ? "1 file" : `${total} files`;
  elements.toolFilesEmpty.hidden = total > 0;
  elements.toolExactGrants.dataset.enabledCount = String(enabledCount);
  if (!toolExactRowById()) {
    state.selectedToolExactId = rows[0]?.dataset.toolExactId ?? null;
  }
  refreshToolExactEditor();
}

function refreshToolExactEditor() {
  const selectedRow = toolExactRowById();
  elements.toolExactEditorEmpty.hidden = Boolean(selectedRow);
  elements.toolExactEditorBody.hidden = !selectedRow;
  for (const row of toolExactRows()) {
    const selected = row === selectedRow;
    row.classList.toggle("is-selected", selected);
    row.querySelector('[data-action="select-exact-tool"]').setAttribute("aria-pressed", String(selected));
  }
  if (!selectedRow) {
    return;
  }
  const pathState = selectedRow.querySelector('[data-role="state"]');
  elements.toolExactEditorName.value = selectedRow.querySelector('[data-field="name"]').value;
  elements.toolExactEditorPath.value = selectedRow.querySelector('[data-field="path"]').value;
  elements.toolExactEditorPriority.value = selectedRow.querySelector('[data-field="priority"]').value;
  elements.toolExactEditorEnabled.checked = selectedRow.querySelector('[data-field="enabled"]').checked;
  elements.toolExactEditorTitle.textContent = elements.toolExactEditorName.value || "Untitled exact tool";
  elements.toolExactEditorPathState.textContent = toolSourceStatusText(selectedRow);
  elements.toolExactEditorPathState.dataset.validationStatus = pathState?.dataset.activeStatus ?? "idle";
}

function syncToolExactEditor() {
  const row = toolExactRowById();
  if (!row) {
    return;
  }
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const priorityInput = row.querySelector('[data-field="priority"]');
  const enabledInput = row.querySelector('[data-field="enabled"]');
  const pathState = row.querySelector('[data-role="state"]');
  const nextPath = elements.toolExactEditorPath.value;
  const changedPath = pathInput.value !== nextPath;

  nameInput.value = elements.toolExactEditorName.value;
  pathInput.value = nextPath;
  priorityInput.value = elements.toolExactEditorPriority.value;
  enabledInput.checked = elements.toolExactEditorEnabled.checked;
  if (changedPath) {
    setEntryPathState(
      row,
      pathState,
      nextPath.trim() ? "Not validated · path changed" : "File path is required",
      nextPath.trim() ? "pending" : "invalid"
    );
  }
  refreshEntryEnabledState(row, pathState);
  updateToolExactEntrySummary(row);
  elements.toolExactEditorTitle.textContent = nameInput.value.trim() || "Untitled exact tool";
  elements.toolExactEditorPathState.textContent = toolSourceStatusText(row);
  elements.toolExactEditorPathState.dataset.validationStatus = pathState?.dataset.activeStatus ?? "idle";
  markDirty();
}

function toolGrantId(row, kind, entry) {
  return `${row.dataset.toolSourceId}:${kind}:${scanFileKey(entry.path)}`;
}

function toolGrantRecords(row = toolSourceRowById()) {
  if (!row) {
    return [];
  }
  return [
    ...sourceScanEntries(row, "tool").map((entry) => ({ id: toolGrantId(row, "tool", entry), kind: "tool", entry })),
    ...sourceScanEntries(row, "document").map((entry) => ({ id: toolGrantId(row, "document", entry), kind: "document", entry }))
  ];
}

function toolGrantMatchesFilters(record, kind = activeToolGrantKind()) {
  const query = elements.toolGrantFilter.value.trim().toLocaleLowerCase();
  const status = elements.toolGrantStatusFilter.value;
  const enabled = record.entry.enabled !== false;
  const matchesText = matchesOperatorFilter(`${record.entry.name}\n${record.entry.path}`, query);
  const matchesStatus = status === "all" || (status === "enabled" ? enabled : !enabled);
  return matchesText && record.kind === kind && matchesStatus;
}

function selectedToolGrantRecord() {
  return toolGrantRecords().find((record) => record.id === state.selectedToolGrantId) ?? null;
}

function updateToolGrantEditor() {
  const record = selectedToolGrantRecord();
  elements.toolGrantEditor.hidden = !record;
  if (!record) {
    return;
  }
  elements.toolGrantEditorTitle.textContent = record.entry.name || "Untitled grant";
  elements.toolGrantEditorName.value = record.entry.name ?? "";
  elements.toolGrantEditorPriorityField.hidden = record.kind !== "tool";
  elements.toolGrantEditorPriority.value = record.kind === "tool" ? String(record.entry.priority ?? 0) : "";
  elements.toolGrantEditorPath.textContent = record.entry.path;
  elements.toolGrantEditorPath.title = record.entry.path;
  elements.toolGrantEditorEnabled.checked = record.entry.enabled !== false;
}

function selectToolGrant(record) {
  state.selectedToolGrantId = record?.id ?? null;
  renderToolSourceGrants();
}

function renderToolSourceGrants() {
  const source = toolSourceRowById();
  const kind = activeToolGrantKind();
  elements.toolGrantsList.replaceChildren();
  if (!source) {
    elements.toolGrantsEmpty.hidden = false;
    elements.toolGrantsFilterEmpty.hidden = true;
    updateToolGrantEditor();
    return;
  }
  const records = toolGrantRecords(source).filter((record) => record.kind === kind);
  const visibleRecords = records.filter((record) => toolGrantMatchesFilters(record, kind));
  elements.toolGrantsEmpty.hidden = records.length > 0;
  elements.toolGrantsFilterEmpty.hidden = records.length === 0 || visibleRecords.length > 0;

  const selected = selectedToolGrantRecord();
  if (!selected || !visibleRecords.some((record) => record.id === selected.id)) {
    state.selectedToolGrantId = visibleRecords[0]?.id ?? null;
  }

  for (const record of visibleRecords) {
    const row = document.createElement("article");
    row.className = "tool-grant-entry";
    row.dataset.grantId = record.id;
    row.dataset.grantKind = record.kind;
    row.classList.toggle("is-selected", record.id === state.selectedToolGrantId);
    row.classList.toggle("is-disabled", record.entry.enabled === false);

    const select = document.createElement("button");
    select.className = "tool-grant-select";
    select.type = "button";
    select.setAttribute("aria-label", `Edit ${record.kind} grant ${record.entry.name || record.entry.path}`);
    select.setAttribute("aria-pressed", String(record.id === state.selectedToolGrantId));
    const name = document.createElement("span");
    name.dataset.role = "tool-grant-name";
    name.textContent = record.entry.name || "Untitled grant";
    const filePath = document.createElement("span");
    filePath.className = "tool-grant-path";
    filePath.dataset.role = "tool-grant-path";
    filePath.textContent = compactLocalPath(record.entry.path);
    filePath.title = record.entry.path;
    const priority = document.createElement("span");
    priority.className = "tool-grant-priority";
    priority.dataset.role = "tool-grant-priority";
    priority.textContent = record.kind === "tool" ? String(record.entry.priority ?? 0) : "—";
    select.append(name, filePath, priority);
    select.addEventListener("click", () => selectToolGrant(record));

    const enabled = document.createElement("label");
    enabled.className = "entry-enabled";
    const enabledInput = document.createElement("input");
    enabledInput.type = "checkbox";
    enabledInput.dataset.field = "enabled";
    enabledInput.checked = record.entry.enabled !== false;
    enabledInput.setAttribute("aria-label", `Enable ${record.kind} grant ${record.entry.name || record.entry.path}`);
    const enabledSwitch = document.createElement("span");
    enabledSwitch.className = "entry-switch";
    enabledSwitch.setAttribute("aria-hidden", "true");
    const enabledLabel = document.createElement("span");
    enabledLabel.dataset.role = "enabled-label";
    enabled.append(enabledInput, enabledSwitch, enabledLabel);
    enabledInput.addEventListener("change", () => {
      record.entry.enabled = enabledInput.checked;
      updateToolSourceEntrySummary(source);
      updateToolSourceInspectorHeader(source);
      renderToolSourceGrants();
      markDirty();
    });

    const copy = document.createElement("button");
    copy.className = "icon-button tool-grant-copy";
    copy.type = "button";
    copy.textContent = "⧉";
    copy.setAttribute("aria-label", `Copy path for ${record.entry.name || record.entry.path}`);
    copy.addEventListener("click", () => copyLocalPath(record.entry.path));
    row.append(select, enabled, copy);
    initializeEntryToggle(row, null, enabledInput.checked);
    elements.toolGrantsList.append(row);
  }
  updateToolGrantEditor();
}

function syncToolGrantEditor() {
  const record = selectedToolGrantRecord();
  const source = toolSourceRowById();
  if (!record || !source) {
    return;
  }
  record.entry.name = elements.toolGrantEditorName.value;
  if (record.kind === "tool") {
    record.entry.priority = Number(elements.toolGrantEditorPriority.value);
  }
  record.entry.enabled = elements.toolGrantEditorEnabled.checked;
  const row = [...elements.toolGrantsList.querySelectorAll(".tool-grant-entry")]
    .find((entry) => entry.dataset.grantId === record.id);
  row?.querySelector('[data-role="tool-grant-name"]')?.replaceChildren(document.createTextNode(record.entry.name || "Untitled grant"));
  row?.querySelector('[data-role="tool-grant-priority"]')?.replaceChildren(document.createTextNode(record.kind === "tool" ? String(record.entry.priority ?? 0) : "—"));
  row?.classList.toggle("is-disabled", record.entry.enabled === false);
  elements.toolGrantEditorTitle.textContent = record.entry.name || "Untitled grant";
  updateToolSourceEntrySummary(source);
  updateToolSourceInspectorHeader(source);
  markDirty();
}

function removeSelectedToolGrant() {
  const record = selectedToolGrantRecord();
  const source = toolSourceRowById();
  if (!record || !source) {
    return;
  }
  const sourceResults = state.folderScanResults.get(source.dataset.folderScanKey);
  sourceResults[record.kind].entries = sourceResults[record.kind].entries
    .filter((entry) => scanFileKey(entry.path) !== scanFileKey(record.entry.path));
  state.selectedToolGrantId = null;
  updateToolSourceEntrySummary(source);
  updateToolSourceInspectorHeader(source);
  renderToolSourceGrants();
  markDirty();
}

function setVisibleToolGrantsEnabled(enabled) {
  const source = toolSourceRowById();
  if (!source) {
    return;
  }
  const kind = activeToolGrantKind();
  const visibleRecords = toolGrantRecords(source).filter((record) => toolGrantMatchesFilters(record, kind));
  for (const record of visibleRecords) {
    record.entry.enabled = enabled;
  }
  updateToolSourceEntrySummary(source);
  updateToolSourceInspectorHeader(source);
  renderToolSourceGrants();
  if (visibleRecords.length > 0) {
    markDirty();
  }
}

async function copyLocalPath(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("Path copied.", "success");
  } catch {
    showToast("The path could not be copied automatically. Select it from the editor instead.", "error");
  }
}

function appendToolDirectory(directory = {}, availability = undefined) {
  const fragment = elements.toolDirectoryTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const priorityInput = row.querySelector('[data-field="priority"]');
  const recursiveInput = row.querySelector('[data-field="recursive"]');
  const documentRecursiveInput = row.querySelector('[data-field="documentRecursive"]');
  const includeDocsInput = row.querySelector('[data-field="includeDocs"]');
  const enabledInput = row.querySelector('[data-field="enabled"]');
  const pathState = row.querySelector('[data-role="state"]');
  const instructionInput = row.querySelector('[data-role="folder-instruction"]');

  state.toolSourceRowCounter += 1;
  row.dataset.toolSourceId = `tool-source-${state.toolSourceRowCounter}`;
  const normalized = typeof directory === "string"
    ? { path: directory, priority: 0, recursive: true, includeDocs: true }
    : directory;
  nameInput.value = normalized.name ?? friendlyPathName(normalized.path ?? "", "tool-folder");
  pathInput.value = normalized.path ?? "";
  priorityInput.value = normalized.priority ?? 0;
  recursiveInput.checked = normalized.recursive !== false;
  documentRecursiveInput.checked = normalized.documentRecursive ?? recursiveInput.checked;
  includeDocsInput.checked = normalized.includeDocs !== false;
  instructionInput.value = normalized.instruction ?? normalized.humanNote ?? "";
  applyEntryAvailability(row, pathState, availability, "directory");
  initializeEntryToggle(row, pathState, entryEnabled(normalized));
  initializePathValidation(row, pathState, pathInput, "directory");
  row.dataset.folderScanKey = folderScanKey(pathInput.value);
  for (const input of row.querySelectorAll("input")) {
    attachConfigurationInput(input);
  }
  const refresh = () => {
    updateToolSourceEntrySummary(row);
    updateToolSourceCatalog();
    if (row.dataset.toolSourceId === state.selectedToolSourceId) {
      refreshToolSourceInspector();
    }
  };
  nameInput.addEventListener("input", refresh);
  pathInput.addEventListener("input", () => {
    const nextKey = folderScanKey(pathInput.value);
    if (row.dataset.folderScanKey !== nextKey) {
      state.folderScanResults.delete(row.dataset.folderScanKey);
      row.dataset.folderScanKey = nextKey;
      state.selectedToolGrantId = null;
    }
    refresh();
  });
  priorityInput.addEventListener("input", refresh);
  recursiveInput.addEventListener("change", refresh);
  documentRecursiveInput.addEventListener("change", refresh);
  includeDocsInput.addEventListener("change", refresh);
  enabledInput.addEventListener("change", refresh);
  instructionInput.addEventListener("input", () => {
    if (row.dataset.toolSourceId === state.selectedToolSourceId) {
      updateToolSourceInspectorHeader(row);
    }
  });
  row.querySelector('[data-action="select-source"]').addEventListener("click", () => selectToolSource(row));
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    const next = row.nextElementSibling ?? row.previousElementSibling;
    const wasSelected = row.dataset.toolSourceId === state.selectedToolSourceId;
    state.folderScanResults.delete(row.dataset.folderScanKey);
    row.remove();
    if (wasSelected) {
      state.selectedToolSourceId = next?.dataset.toolSourceId ?? null;
      state.selectedToolGrantId = null;
    }
    updateEmptyStates();
    refreshToolSourceInspector();
    markDirty();
  });
  seedFolderScanResults(row, normalized);
  elements.toolDirectoriesList.append(row);
  updateToolSourceEntrySummary(row);
  updateEmptyStates();
  if (!state.selectedToolSourceId) {
    selectToolSource(row);
  }
  return row;
}

function setFolderScanBusy(_row, activeButton, busy) {
  const buttons = [elements.toolSourceScanTool, elements.toolSourceScanDocument];
  for (const button of buttons) {
    if (busy) {
      button.dataset.previousLabel = button.textContent;
      if (button === activeButton) {
        button.textContent = "Scanning…";
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
    : documentGrantRowsByKind("file").map((row) => row.querySelector('[data-field="name"]'));
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
  updateToolSourceEntrySummary(row);
  updateToolSourceCatalog();
  if (row.dataset.toolSourceId === state.selectedToolSourceId) {
    refreshToolSourceInspector();
  }
}

function appendToolFile(toolFile = {}, availability = undefined) {
  const fragment = elements.toolFileTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const priorityInput = row.querySelector('[data-field="priority"]');
  const enabledInput = row.querySelector('[data-field="enabled"]');
  const pathState = row.querySelector('[data-role="state"]');

  state.toolExactRowCounter += 1;
  row.dataset.toolExactId = `tool-exact-${state.toolExactRowCounter}`;
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
  const refresh = () => {
    updateToolExactEntrySummary(row);
    updateToolExactCatalog();
  };
  nameInput.addEventListener("input", refresh);
  pathInput.addEventListener("input", refresh);
  priorityInput.addEventListener("input", refresh);
  enabledInput.addEventListener("change", refresh);
  row.querySelector('[data-action="select-exact-tool"]').addEventListener("click", () => selectToolExact(row));
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    const next = row.nextElementSibling ?? row.previousElementSibling;
    const wasSelected = row.dataset.toolExactId === state.selectedToolExactId;
    row.remove();
    if (wasSelected) {
      state.selectedToolExactId = next?.dataset.toolExactId ?? null;
    }
    updateEmptyStates();
    refreshToolExactEditor();
    markDirty();
  });

  elements.toolFilesList.append(row);
  updateToolExactEntrySummary(row);
  updateEmptyStates();
  if (!state.selectedToolExactId) {
    selectToolExact(row);
  }
  return row;
}

function applySecretInspection(row, pathState, inspection = undefined) {
  delete pathState.dataset.validDetail;
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
}

function appendSecretFile(secretFile = {}, inspection = undefined) {
  const fragment = elements.secretFileTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const formatInput = row.querySelector('[data-field="format"]');
  const enabledInput = row.querySelector('[data-field="enabled"]');
  const pathState = row.querySelector('[data-role="state"]');

  state.secretRowCounter += 1;
  row.dataset.secretId = `secret-${state.secretRowCounter}`;
  const normalized = typeof secretFile === "string" ? { path: secretFile, format: "auto" } : secretFile;
  nameInput.value = normalized.name ?? friendlyPathName(normalized.path ?? "", "secret-file");
  pathInput.value = normalized.path ?? "";
  formatInput.value = normalized.format ?? "auto";
  applySecretInspection(row, pathState, inspection);
  initializeEntryToggle(row, pathState, entryEnabled(normalized));
  initializePathValidation(row, pathState, pathInput, "file");

  for (const input of row.querySelectorAll("input, select")) {
    attachConfigurationInput(input);
  }
  enabledInput.addEventListener("change", () => {
    updateSecretEntrySummary(row);
    updateSecretCatalog();
    if (row.dataset.secretId === state.selectedSecretId) {
      updateSecretInspectorHeader(row);
    }
  });
  row.querySelector('[data-action="select-secret"]').addEventListener("click", () => selectSecret(row));
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    const nextRow = row.nextElementSibling ?? row.previousElementSibling;
    const wasSelected = row.dataset.secretId === state.selectedSecretId;
    row.remove();
    if (wasSelected) {
      state.selectedSecretId = nextRow?.dataset.secretId ?? null;
    }
    updateEmptyStates();
    refreshSecretInspector();
    markDirty();
  });

  elements.secretFilesList.append(row);
  updateSecretEntrySummary(row);
  updateEmptyStates();
  if (!state.selectedSecretId) {
    selectSecret(row);
  }
  return row;
}

function secretRows() {
  return [...elements.secretFilesList.querySelectorAll(".secret-file-entry")];
}

function secretRowById(secretId = state.selectedSecretId) {
  if (!secretId) {
    return null;
  }
  return secretRows().find((row) => row.dataset.secretId === secretId) ?? null;
}

function secretFormatLabel(format) {
  if (format === "env") {
    return "NAME=value";
  }
  if (format === "opaque") {
    return "Opaque";
  }
  return "Auto";
}

function secretStatusText(row) {
  return row.querySelector('[data-role="state"]')?.textContent?.trim() || "Not validated";
}

function updateSecretEntrySummary(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const secretPath = row.querySelector('[data-field="path"]').value.trim();
  const format = row.querySelector('[data-field="format"]').value;
  const enabled = row.querySelector('[data-field="enabled"]').checked;
  const pathState = row.querySelector('[data-role="state"]');
  const selection = row.querySelector('[data-action="select-secret"]');
  const formatBadge = row.querySelector('[data-role="secret-file-format"]');

  row.querySelector('[data-role="secret-file-name"]').textContent = name || "Untitled secret";
  formatBadge.textContent = secretFormatLabel(format);
  formatBadge.className = `secret-file-format is-${format}`;
  row.querySelector('[data-role="secret-file-path"]').textContent = compactLocalPath(secretPath);
  row.querySelector('[data-role="secret-file-path"]').title = secretPath;
  row.querySelector('[data-role="secret-file-validation"]').textContent = secretStatusText(row);
  row.querySelector('[data-role="secret-file-validation"]').dataset.validationStatus = pathState?.dataset.activeStatus ?? "idle";
  selection.setAttribute("aria-label", `Edit secret file ${name || "untitled secret"}`);
  row.dataset.secretSearch = `${name}\n${secretPath}`.toLocaleLowerCase();
  row.classList.toggle("is-empty-path", !secretPath);
  row.classList.toggle("is-disabled", !enabled);
}

function updateSecretInspectorHeader(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const format = row.querySelector('[data-field="format"]').value;
  const enabled = row.querySelector('[data-field="enabled"]').checked;
  const pathState = row.querySelector('[data-role="state"]');
  elements.secretEditorTitle.textContent = name || "Untitled secret";
  elements.secretEditorMeta.textContent = `${secretFormatLabel(format)} policy · ${enabled ? "Enabled" : "Disabled"}`;
  elements.secretEditorPathState.textContent = secretStatusText(row);
  elements.secretEditorPathState.dataset.validationStatus = pathState?.dataset.activeStatus ?? "idle";
}

function refreshSecretInspector() {
  const selectedRow = secretRowById();
  elements.secretInspectorEmpty.hidden = Boolean(selectedRow);
  elements.secretInspectorBody.hidden = !selectedRow;
  elements.secretInspector.classList.toggle("has-selection", Boolean(selectedRow));

  for (const row of secretRows()) {
    const selected = row === selectedRow;
    row.classList.toggle("is-selected", selected);
    row.querySelector('[data-action="select-secret"]').setAttribute("aria-pressed", String(selected));
  }

  if (!selectedRow) {
    return;
  }

  elements.secretEditorName.value = selectedRow.querySelector('[data-field="name"]').value;
  elements.secretEditorPath.value = selectedRow.querySelector('[data-field="path"]').value;
  elements.secretEditorFormat.value = selectedRow.querySelector('[data-field="format"]').value;
  elements.secretEditorEnabled.checked = selectedRow.querySelector('[data-field="enabled"]').checked;
  updateSecretInspectorHeader(selectedRow);
}

function selectSecret(row, { focus = false } = {}) {
  state.selectedSecretId = row?.dataset.secretId ?? null;
  refreshSecretInspector();
  if (focus && row) {
    elements.secretEditorName.focus();
    elements.secretEditorName.select();
  }
}

function updateSecretCatalog() {
  const query = elements.secretCatalogFilter.value.trim().toLocaleLowerCase();
  const status = elements.secretStatusFilter.value;
  const rows = secretRows();
  let visibleCount = 0;
  let enabledCount = 0;

  for (const row of rows) {
    updateSecretEntrySummary(row);
    const enabled = row.querySelector('[data-field="enabled"]').checked;
    const matchesText = matchesOperatorFilter(row.dataset.secretSearch, query);
    const matchesStatus = status === "all" || (status === "enabled" ? enabled : !enabled);
    row.hidden = !matchesText || !matchesStatus;
    if (!row.hidden) {
      visibleCount += 1;
    }
    if (enabled) {
      enabledCount += 1;
    }
  }

  const total = rows.length;
  const label = total === 1 ? "1 grant" : `${total} grants`;
  elements.secretCount.textContent = visibleCount === total ? label : `${visibleCount}/${total} shown`;
  elements.secretEnabledCount.textContent = `${enabledCount} enabled`;
  elements.secretFilesEmpty.hidden = total > 0;
  elements.secretFilesFilterEmpty.hidden = total === 0 || visibleCount > 0;

  const selectedRow = secretRowById();
  if (!selectedRow || selectedRow.hidden) {
    state.selectedSecretId = rows.find((row) => !row.hidden)?.dataset.secretId ?? null;
    refreshSecretInspector();
  }
}

function markSecretForReinspection(row) {
  const pathInput = row.querySelector('[data-field="path"]');
  const pathState = row.querySelector('[data-role="state"]');
  delete pathState.dataset.validDetail;
  const hasPath = pathInput.value.trim().length > 0;
  setEntryPathState(
    row,
    pathState,
    hasPath ? "Not validated · save to refresh detected fields" : "Secret file path is required",
    hasPath ? "pending" : "invalid"
  );
}

function syncSecretInspector() {
  const row = secretRowById();
  if (!row) {
    return;
  }
  const nameInput = row.querySelector('[data-field="name"]');
  const pathInput = row.querySelector('[data-field="path"]');
  const formatInput = row.querySelector('[data-field="format"]');
  const enabledInput = row.querySelector('[data-field="enabled"]');
  const changedPath = pathInput.value !== elements.secretEditorPath.value;
  const changedFormat = formatInput.value !== elements.secretEditorFormat.value;

  nameInput.value = elements.secretEditorName.value;
  pathInput.value = elements.secretEditorPath.value;
  formatInput.value = elements.secretEditorFormat.value;
  enabledInput.checked = elements.secretEditorEnabled.checked;
  if (changedPath || changedFormat) {
    markSecretForReinspection(row);
  }
  refreshEntryEnabledState(row, row.querySelector('[data-role="state"]'));
  updateSecretEntrySummary(row);
  updateSecretInspectorHeader(row);
  updateSecretCatalog();
  markDirty();
}

function promptRowById(promptId = state.selectedPromptId) {
  if (!promptId) {
    return null;
  }
  return [...elements.promptsList.querySelectorAll(".prompt-entry")]
    .find((row) => row.dataset.promptId === promptId) ?? null;
}

function promptPreview(content) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No prompt text yet";
  }
  return normalized.length > 150 ? `${normalized.slice(0, 147)}…` : normalized;
}

function promptMetadata(content) {
  const characterCount = content.length;
  const lineCount = content ? content.split(/\r?\n/).length : 0;
  return `${characterCount.toLocaleString()} character${characterCount === 1 ? "" : "s"} · ${lineCount} line${lineCount === 1 ? "" : "s"}`;
}

function updateInstructionSummary(input, summaryElement) {
  const instruction = input.value.replace(/\s+/g, " ").trim();
  const characterCount = instruction.length;
  const configured = characterCount > 0;
  summaryElement.textContent = configured
    ? `Configured · ${characterCount.toLocaleString()} chars`
    : "No instruction";
  summaryElement.dataset.state = configured ? "configured" : "empty";
  summaryElement.title = configured
    ? `Catalog instruction configured (${characterCount.toLocaleString()} characters). Activate to edit.`
    : "No catalog instruction configured. Activate to add one.";
  summaryElement.setAttribute("aria-label", summaryElement.title);
}

function updatePromptInstructionSummary() {
  updateInstructionSummary(elements.promptsInstruction, elements.promptsInstructionSummary);
}

function updatePromptEntrySummary(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const keywords = splitKeywords(row.querySelector('[data-field="keywords"]').value);
  const content = row.querySelector('[data-field="content"]').value;
  const enabled = row.querySelector('[data-field="enabled"]').checked;
  const selection = row.querySelector('[data-action="select"]');

  row.querySelector('[data-role="prompt-name"]').textContent = name || "Untitled prompt";
  row.querySelector('[data-role="prompt-keywords"]').textContent = keywords.length > 0 ? keywords.join(" · ") : "No keywords";
  row.querySelector('[data-role="prompt-preview"]').textContent = promptPreview(content);
  selection.setAttribute("aria-label", `Edit reusable prompt ${name || "untitled prompt"}`);
  // Keep catalog filtering aligned with prompt discovery: names and discovery
  // keywords are searchable, while the full body stays an editor-only detail.
  row.dataset.promptSearch = `${name}\n${keywords.join(" ")}`.toLocaleLowerCase();
  row.classList.toggle("is-empty-content", !content.trim());
  row.classList.toggle("is-disabled", !enabled);
}

function updatePromptCatalog() {
  const query = elements.promptCatalogFilter.value.trim().toLocaleLowerCase();
  const status = elements.promptStatusFilter.value;
  const rows = [...elements.promptsList.querySelectorAll(".prompt-entry")];
  let visibleCount = 0;
  let enabledCount = 0;

  for (const row of rows) {
    const enabled = row.querySelector('[data-field="enabled"]').checked;
    const matchesText = !query || row.dataset.promptSearch.includes(query);
    const matchesStatus = status === "all" || (status === "enabled" ? enabled : !enabled);
    const visible = matchesText && matchesStatus;
    row.hidden = !visible;
    if (visible) {
      visibleCount += 1;
    }
    if (enabled) {
      enabledCount += 1;
    }
  }

  const total = rows.length;
  const countLabel = total === 1 ? "1 prompt" : `${total} prompts`;
  elements.promptsCount.textContent = visibleCount === total
    ? `${countLabel} · ${enabledCount} enabled`
    : `${visibleCount}/${total} shown · ${enabledCount} enabled`;
  elements.promptsEmpty.hidden = total > 0;
  elements.promptsFilterEmpty.hidden = total === 0 || visibleCount > 0;

  const selectedRow = promptRowById();
  if (selectedRow?.hidden) {
    state.selectedPromptId = rows.find((row) => !row.hidden)?.dataset.promptId ?? null;
    refreshPromptEditor();
  }
}

function updatePromptEditorMeta(row) {
  const name = row.querySelector('[data-field="name"]').value.trim();
  const content = row.querySelector('[data-field="content"]').value;
  elements.promptEditorTitle.textContent = name || "Untitled prompt";
  elements.promptEditorMeta.textContent = promptMetadata(content);
}

function setPromptFocusMode(enabled) {
  const canFocus = Boolean(enabled && promptRowById());
  state.promptFocusMode = canFocus;
  document.body.classList.toggle("prompt-focus-mode", canFocus);
  elements.focusPromptEditor.setAttribute("aria-pressed", String(canFocus));
  elements.focusPromptEditor.textContent = canFocus ? "Exit focus" : "Focus editor";
  elements.focusPromptEditor.title = canFocus
    ? "Return to the prompt catalog"
    : "Open a focused prompt editor";
  if (canFocus) {
    requestAnimationFrame(() => elements.promptEditorContent.focus());
  }
}

function refreshPromptEditor() {
  const selectedRow = promptRowById();
  elements.promptEditorEmpty.hidden = Boolean(selectedRow);
  elements.promptEditorBody.hidden = !selectedRow;
  elements.promptEditorPanel.classList.toggle("has-selection", Boolean(selectedRow));
  elements.focusPromptEditor.disabled = !selectedRow;

  for (const row of elements.promptsList.querySelectorAll(".prompt-entry")) {
    const selected = row === selectedRow;
    row.classList.toggle("is-selected", selected);
    row.querySelector('[data-action="select"]').setAttribute("aria-pressed", String(selected));
  }

  if (!selectedRow) {
    if (state.promptFocusMode) {
      setPromptFocusMode(false);
    }
    return;
  }

  elements.promptEditorName.value = selectedRow.querySelector('[data-field="name"]').value;
  elements.promptEditorKeywords.value = selectedRow.querySelector('[data-field="keywords"]').value;
  elements.promptEditorContent.value = selectedRow.querySelector('[data-field="content"]').value;
  elements.promptEditorEnabled.checked = selectedRow.querySelector('[data-field="enabled"]').checked;
  updatePromptEditorMeta(selectedRow);
}

function selectPrompt(row, { focus = false } = {}) {
  state.selectedPromptId = row?.dataset.promptId ?? null;
  refreshPromptEditor();
  if (!focus || !row) {
    return;
  }
  const content = row.querySelector('[data-field="content"]').value;
  const editorField = content.trim() ? elements.promptEditorContent : elements.promptEditorName;
  editorField.focus();
  if (editorField === elements.promptEditorName) {
    editorField.select();
  }
}

function syncPromptEditor() {
  const row = promptRowById();
  if (!row) {
    return;
  }
  row.querySelector('[data-field="name"]').value = elements.promptEditorName.value;
  row.querySelector('[data-field="keywords"]').value = elements.promptEditorKeywords.value;
  row.querySelector('[data-field="content"]').value = elements.promptEditorContent.value;
  row.querySelector('[data-field="enabled"]').checked = elements.promptEditorEnabled.checked;
  refreshEntryEnabledState(row, null);
  updatePromptEntrySummary(row);
  updatePromptEditorMeta(row);
  updatePromptCatalog();
  markDirty();
}

function appendPrompt(prompt = {}, { select = false, focusEditor = false } = {}) {
  const fragment = elements.promptTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".entry-row");
  const nameInput = row.querySelector('[data-field="name"]');
  const keywordsInput = row.querySelector('[data-field="keywords"]');
  const contentInput = row.querySelector('[data-field="content"]');
  const enabledInput = row.querySelector('[data-field="enabled"]');

  state.promptRowCounter += 1;
  row.dataset.promptId = `prompt-${state.promptRowCounter}`;
  nameInput.value = prompt.name ?? uniquePromptName("reusable-prompt");
  keywordsInput.value = Array.isArray(prompt.keywords) ? prompt.keywords.join(";") : (prompt.keywords ?? "");
  contentInput.value = prompt.content ?? "";
  initializeEntryToggle(row, null, entryEnabled(prompt));
  updatePromptEntrySummary(row);

  attachConfigurationInput(enabledInput);
  enabledInput.addEventListener("change", () => {
    updatePromptEntrySummary(row);
    updatePromptCatalog();
    if (row.dataset.promptId === state.selectedPromptId) {
      elements.promptEditorEnabled.checked = enabledInput.checked;
      updatePromptEditorMeta(row);
    }
  });
  row.querySelector('[data-action="select"]').addEventListener("click", () => selectPrompt(row));
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    const nextRow = row.nextElementSibling ?? row.previousElementSibling;
    const wasSelected = row.dataset.promptId === state.selectedPromptId;
    row.remove();
    if (wasSelected) {
      state.selectedPromptId = nextRow?.dataset.promptId ?? null;
    }
    updateEmptyStates();
    refreshPromptEditor();
    markDirty();
  });

  elements.promptsList.append(row);
  updateEmptyStates();
  if (select || !state.selectedPromptId) {
    selectPrompt(row, { focus: focusEditor });
  }
  return row;
}

function updateEmptyStates() {
  updateDocumentGrantCatalog();
  updateToolSourceCatalog();
  updateToolExactCatalog();
  elements.promptsEmpty.hidden = elements.promptsList.children.length > 0;
  updateSecretCatalog();
  updatePromptCatalog();
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
    ...documentGrantRows(),
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
    updateDocumentGrantCatalog();
    const selectedDocumentRow = documentGrantRowById();
    if (selectedDocumentRow) {
      updateDocumentGrantInspectorHeader(selectedDocumentRow);
    }
    updateSecretCatalog();
    const selectedSecretRow = secretRowById();
    if (selectedSecretRow) {
      updateSecretInspectorHeader(selectedSecretRow);
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
    updateDocumentGrantCatalog();
    const selectedDocumentRow = documentGrantRowById();
    if (selectedDocumentRow) {
      updateDocumentGrantInspectorHeader(selectedDocumentRow);
    }
    updateSecretCatalog();
    const selectedSecretRow = secretRowById();
    if (selectedSecretRow) {
      updateSecretInspectorHeader(selectedSecretRow);
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

function catalogInstruction(config, catalog) {
  if (Object.hasOwn(config.instructions ?? {}, catalog)) {
    return config.instructions[catalog] ?? "";
  }
  if (Object.hasOwn(config.humanNotes ?? {}, catalog)) {
    return config.humanNotes[catalog] ?? "";
  }
  return config.humanNote ?? "";
}

function checkedEntryForSavedEntry(entries, savedEntry, index) {
  const name = typeof savedEntry === "string" ? undefined : savedEntry?.name;
  return (name ? entries?.find((entry) => entry.name === name) : undefined) ?? entries?.[index];
}

function rowStillMatchesSavedEntry(row, savedEntry, { includeFormat = false } = {}) {
  if (savedEntry === undefined) {
    return false;
  }
  const normalized = typeof savedEntry === "string" ? { path: savedEntry } : savedEntry;
  const samePath = row.querySelector('[data-field="path"]').value === (normalized.path ?? "");
  const sameEnabled = (row.querySelector('[data-field="enabled"]')?.checked !== false) === entryEnabled(normalized);
  const sameFormat = !includeFormat
    || row.querySelector('[data-field="format"]')?.value === (normalized.format ?? "auto");
  return samePath && sameEnabled && sameFormat;
}

function applySavedEntryChecks(rows, savedEntries, checkedEntries, expectedKind, { secret = false } = {}) {
  rows.forEach((row, index) => {
    const savedEntry = savedEntries?.[index];
    if (!rowStillMatchesSavedEntry(row, savedEntry, { includeFormat: secret })) {
      return;
    }
    const checkedEntry = checkedEntryForSavedEntry(checkedEntries, savedEntry, index);
    const pathState = row.querySelector('[data-role="state"]');
    if (secret) {
      applySecretInspection(row, pathState, checkedEntry);
    } else {
      applyEntryAvailability(row, pathState, checkedEntry, expectedKind);
    }
  });
}

function updateConfigurationStatus(config, check, source, { saved = false } = {}) {
  const tools = config.tools ?? { directories: [], files: [] };
  const prompts = Array.isArray(config.prompts) ? config.prompts : [];
  const secrets = config.secrets ?? { files: [] };
  const checkedSource = check?.sources?.[state.sourceKey.toLowerCase()];
  const unavailableRoots = checkedSource?.roots?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableFiles = checkedSource?.files?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableToolDirectories = check?.tools?.directories?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableToolFiles = check?.tools?.files?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
  const unavailableSecrets = check?.secrets?.files?.filter((entry) => entry.enabled !== false && entry.available === false).length ?? 0;
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
    setPageStatus(
      "warning",
      saved ? "Configuration saved with unavailable paths" : "Configuration loaded with unavailable paths",
      `${unavailableTotal} document, tool, or secret path(s) need attention.`
    );
    return;
  }
  setPageStatus(
    "ready",
    saved ? "Configuration saved" : "Configuration is valid",
    `${enabledTotal} enabled and ${disabledTotal} disabled across Prompts, Documents, Tools, and Secrets.`
  );
}

function applySavedConfigurationState(config, check) {
  const source = config.sources?.[state.sourceKey] ?? configuredSource(config);
  const tools = config.tools ?? { directories: [], files: [] };
  const secrets = config.secrets ?? { files: [] };
  const checkedSource = check?.sources?.[state.sourceKey.toLowerCase()];

  state.config = config;
  state.check = check;
  applySavedEntryChecks(documentGrantRowsByKind("directory"), source.roots, checkedSource?.roots, "directory");
  applySavedEntryChecks(documentGrantRowsByKind("file"), source.files, checkedSource?.files, "file");
  applySavedEntryChecks(toolSourceRows(), tools.directories, check?.tools?.directories, "directory");
  applySavedEntryChecks(toolExactRows(), tools.files, check?.tools?.files, "file");
  applySavedEntryChecks(secretRows(), secrets.files, check?.secrets?.files, "file", { secret: true });

  const savedIgnoreFile = config.ignoreFile ?? "";
  if (elements.ignoreFile.value === savedIgnoreFile) {
    if (savedIgnoreFile) {
      setIgnoreFilePathState("Valid file", "valid", check?.ignoreFile ?? savedIgnoreFile);
    } else {
      setIgnoreFilePathState("Optional path is not configured.");
    }
  }

  updateInstructionSummary(elements.documentsInstruction, elements.documentsInstructionSummary);
  updateInstructionSummary(elements.toolsInstruction, elements.toolsInstructionSummary);
  updatePromptInstructionSummary();
  updateInstructionSummary(elements.secretsInstruction, elements.secretsInstructionSummary);
  updateDocumentGrantCatalog();
  refreshDocumentGrantInspector();
  updateToolSourceCatalog();
  refreshToolSourceInspector();
  updateToolExactCatalog();
  refreshToolExactEditor();
  updateSecretCatalog();
  refreshSecretInspector();
  updateConfigurationStatus(config, check, source, { saved: true });
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
  state.selectedPromptId = null;
  state.promptRowCounter = 0;
  state.selectedToolSourceId = null;
  state.toolSourceRowCounter = 0;
  state.activeToolSourceSection = "overview";
  state.selectedToolGrantId = null;
  state.selectedToolExactId = null;
  state.toolExactRowCounter = 0;
  state.selectedDocumentGrantId = null;
  state.documentGrantRowCounter = 0;
  state.selectedSecretId = null;
  state.secretRowCounter = 0;
  elements.documentGrantFilter.value = "";
  elements.documentGrantTypeFilter.value = "all";
  elements.documentGrantStatusFilter.value = "all";
  elements.secretCatalogFilter.value = "";
  elements.secretStatusFilter.value = "all";
  elements.toolSourceFilter.value = "";
  elements.toolSourceStatusFilter.value = "all";
  elements.toolGrantFilter.value = "";
  elements.toolGrantStatusFilter.value = "all";

  elements.documentsInstruction.value = catalogInstruction(config, "documents");
  elements.toolsInstruction.value = catalogInstruction(config, "tools");
  elements.promptsInstruction.value = catalogInstruction(config, "prompts");
  elements.secretsInstruction.value = catalogInstruction(config, "secrets");

  elements.documentGrantList.replaceChildren();
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
  updateInstructionSummary(elements.documentsInstruction, elements.documentsInstructionSummary);
  updateInstructionSummary(elements.toolsInstruction, elements.toolsInstructionSummary);
  updatePromptInstructionSummary();
  updateInstructionSummary(elements.secretsInstruction, elements.secretsInstructionSummary);
  updateDocumentGrantCatalog();
  refreshDocumentGrantInspector();
  updateSecretCatalog();
  refreshSecretInspector();
  updateToolSourceCatalog();
  refreshToolSourceInspector();
  updateToolExactCatalog();
  updatePromptCatalog();
  refreshPromptEditor();

  updateConfigurationStatus(config, check, source);
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

  next.instructions = {
    documents: elements.documentsInstruction.value.trim(),
    tools: elements.toolsInstruction.value.trim(),
    prompts: elements.promptsInstruction.value.trim(),
    secrets: elements.secretsInstruction.value.trim()
  };
  delete next.humanNotes;
  delete next.humanNote;

  source.roots = documentGrantRowsByKind("directory").map((row, index) => {
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

  source.files = documentGrantRowsByKind("file").map((row, index) => {
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
        documentRecursive: row.querySelector('[data-field="documentRecursive"]').checked,
        includeDocs: row.querySelector('[data-field="includeDocs"]').checked,
        enabled: row.querySelector('[data-field="enabled"]').checked
      };
      const instruction = row.querySelector('[data-role="folder-instruction"]').value.trim();
      const scannedToolFiles = collectScannedToolFiles(row, index);
      const scannedDocumentFiles = collectScannedDocumentFiles(row, index);
      if (instruction) {
        directory.instruction = instruction;
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
  if (state.saving) {
    return;
  }
  const saveVersion = state.changeVersion;
  state.saving = true;
  setBusy(elements.saveConfig, true, "Saving…");
  showSavingState();
  try {
    const config = collectConfig();
    const payload = await api("/api/config", { method: "POST", body: { config } });
    applySavedConfigurationState(config, payload.check);
    const hasNewerChanges = state.changeVersion !== saveVersion;
    if (hasNewerChanges) {
      state.dirty = true;
      showDirtyState();
    } else {
      markClean();
    }
    const savedMessage = payload.backupCreated
      ? `Saved. Previous configuration backed up to ${payload.backupPath}`
      : "Configuration saved.";
    showToast(hasNewerChanges ? `${savedMessage} Newer edits remain unsaved.` : savedMessage);
  } catch (error) {
    setPageStatus("error", "Configuration was not saved", error.message);
    if (state.dirty) {
      showDirtyState();
    } else {
      markClean();
    }
    showToast(error.message, "error");
  } finally {
    state.saving = false;
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
  selectSecret(row, { focus: true });
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
      elements.toolSourceFilter.value = "";
      elements.toolSourceStatusFilter.value = "all";
      const row = appendToolDirectory({
        name: uniqueToolDirectoryName(friendlyPathName(payload.path, "tool-folder")),
        path: payload.path,
        priority: 100,
        recursive: true,
        includeDocs: true
      });
      selectToolSource(row, { focus: true });
    } else if (target === "tools") {
      const row = appendToolFile({
        name: uniqueToolFileName(friendlyPathName(payload.path, "tool-file")),
        path: payload.path,
        priority: 100
      });
      elements.toolExactGrants.open = true;
      selectToolExact(row, { focus: true });
    } else if (kind === "directory") {
      elements.documentGrantFilter.value = "";
      elements.documentGrantTypeFilter.value = "all";
      elements.documentGrantStatusFilter.value = "all";
      const row = appendRoot({ name: friendlyPathName(payload.path, "allowed-folder"), path: payload.path, priority: 100 });
      selectDocumentGrant(row, { focus: true });
    } else {
      elements.documentGrantFilter.value = "";
      elements.documentGrantTypeFilter.value = "all";
      elements.documentGrantStatusFilter.value = "all";
      const row = appendFile({
        name: uniqueDocumentFileName(friendlyPathName(payload.path, "document-file")),
        path: payload.path
      });
      selectDocumentGrant(row, { focus: true });
    }
    markDirty();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

function addDroppedItems(items, errors = []) {
  const existingFolders = new Set(documentGrantRowsByKind("directory").map((row) => row.querySelector('[data-field="path"]'))
    .map((input) => comparableLocalPath(input.value)));
  const existingFiles = new Set(documentGrantRowsByKind("file").map((row) => row.querySelector('[data-field="path"]'))
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
  const button = kind === "tool" ? elements.toolSourceScanTool : elements.toolSourceScanDocument;
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
  const selected = ["prompts", "documents", "tools", "secrets", "help"].includes(tabName) ? tabName : "prompts";
  const previousTab = state.activeTab;
  state.activeTab = selected;
  const tabs = {
    documents: { tab: elements.documentsTab, panel: elements.documentsPanel },
    tools: { tab: elements.toolsTab, panel: elements.toolsPanel },
    prompts: { tab: elements.promptsTab, panel: elements.promptsPanel },
    secrets: { tab: elements.secretsTab, panel: elements.secretsPanel },
    help: { tab: elements.helpTab, panel: elements.helpPanel }
  };
  for (const [name, item] of Object.entries(tabs)) {
    const active = name === selected;
    item.tab.classList.toggle("is-active", active);
    item.tab.setAttribute("aria-selected", String(active));
    item.tab.tabIndex = active ? 0 : -1;
    item.panel.hidden = !active;
  }
  if (selected !== previousTab) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  requestAnimationFrame(syncWorkspaceSplitterAria);
  if (focus) {
    tabs[selected].tab.focus({ preventScroll: true });
  }
}

function workspaceSplitterBounds(splitter) {
  if (!window.matchMedia("(min-width: 1101px)").matches) {
    return null;
  }
  const workspace = document.querySelector(`[data-resizable-workspace="${splitter.dataset.workspaceSplitter}"]`);
  if (!workspace) {
    return null;
  }
  const workspaceRect = workspace.getBoundingClientRect();
  const splitterRect = splitter.getBoundingClientRect();
  if (workspaceRect.width <= 0 || splitterRect.width <= 0) {
    return null;
  }
  const masterMin = Number(splitter.dataset.masterMin) || 280;
  const detailMin = Number(splitter.dataset.detailMin) || 360;
  const max = Math.max(masterMin, workspaceRect.width - splitterRect.width - detailMin);
  return { workspace, workspaceRect, splitterRect, min: masterMin, max };
}

function setWorkspaceSplitWidth(splitter, requestedWidth) {
  const bounds = workspaceSplitterBounds(splitter);
  if (!bounds) {
    return;
  }
  const width = Math.min(bounds.max, Math.max(bounds.min, requestedWidth));
  const ratio = width / bounds.workspaceRect.width;
  const minPercent = Math.round((bounds.min / bounds.workspaceRect.width) * 100);
  const maxPercent = Math.round((bounds.max / bounds.workspaceRect.width) * 100);
  const value = Math.round(ratio * 100);
  bounds.workspace.style.setProperty("--workspace-master-width", `${(ratio * 100).toFixed(2)}%`);
  splitter.setAttribute("aria-valuemin", String(minPercent));
  splitter.setAttribute("aria-valuemax", String(maxPercent));
  splitter.setAttribute("aria-valuenow", String(value));
  splitter.setAttribute("aria-valuetext", `${value}% catalog, ${100 - value}% detail`);
}

function resizeWorkspaceFromPointer(splitter, clientX) {
  const bounds = workspaceSplitterBounds(splitter);
  if (!bounds) {
    return;
  }
  setWorkspaceSplitWidth(splitter, clientX - bounds.workspaceRect.left - (bounds.splitterRect.width / 2));
}

function syncWorkspaceSplitterAria() {
  for (const splitter of document.querySelectorAll("[data-workspace-splitter]")) {
    const bounds = workspaceSplitterBounds(splitter);
    const masterPane = bounds?.workspace.firstElementChild;
    if (!bounds || !masterPane || getComputedStyle(masterPane).display === "none") {
      continue;
    }
    setWorkspaceSplitWidth(splitter, masterPane.getBoundingClientRect().width);
  }
}

function finishWorkspaceResize(splitter) {
  if (activeWorkspaceSplitter !== splitter) {
    return;
  }
  activeWorkspaceSplitter = null;
  splitter.classList.remove("is-dragging");
  document.body.classList.remove("is-resizing-workspace");
}

for (const splitter of document.querySelectorAll("[data-workspace-splitter]")) {
  splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !workspaceSplitterBounds(splitter)) {
      return;
    }
    activeWorkspaceSplitter = splitter;
    splitter.classList.add("is-dragging");
    document.body.classList.add("is-resizing-workspace");
    splitter.setPointerCapture(event.pointerId);
    resizeWorkspaceFromPointer(splitter, event.clientX);
    event.preventDefault();
  });
  splitter.addEventListener("pointermove", (event) => {
    if (activeWorkspaceSplitter === splitter && splitter.hasPointerCapture(event.pointerId)) {
      resizeWorkspaceFromPointer(splitter, event.clientX);
    }
  });
  splitter.addEventListener("pointerup", (event) => {
    if (splitter.hasPointerCapture(event.pointerId)) {
      splitter.releasePointerCapture(event.pointerId);
    }
    finishWorkspaceResize(splitter);
  });
  splitter.addEventListener("pointercancel", () => finishWorkspaceResize(splitter));
  splitter.addEventListener("lostpointercapture", () => finishWorkspaceResize(splitter));
  splitter.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    const bounds = workspaceSplitterBounds(splitter);
    const masterPane = bounds?.workspace.firstElementChild;
    if (!bounds || !masterPane) {
      return;
    }
    const step = Math.max(28, Math.round(bounds.workspaceRect.width * 0.04));
    const current = masterPane.getBoundingClientRect().width;
    const requestedWidth = event.key === "Home"
      ? bounds.min
      : event.key === "End"
      ? bounds.max
      : current + (event.key === "ArrowLeft" ? -step : step);
    setWorkspaceSplitWidth(splitter, requestedWidth);
    event.preventDefault();
  });
}

window.addEventListener("resize", () => requestAnimationFrame(syncWorkspaceSplitterAria));

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
  elements.documentsInstruction,
  elements.toolsInstruction,
  elements.promptsInstruction,
  elements.secretsInstruction,
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

elements.documentsInstruction.addEventListener("input", () => {
  updateInstructionSummary(elements.documentsInstruction, elements.documentsInstructionSummary);
});
elements.toolsInstruction.addEventListener("input", () => {
  updateInstructionSummary(elements.toolsInstruction, elements.toolsInstructionSummary);
});
elements.promptsInstruction.addEventListener("input", updatePromptInstructionSummary);
elements.secretsInstruction.addEventListener("input", () => {
  updateInstructionSummary(elements.secretsInstruction, elements.secretsInstructionSummary);
});
elements.toolSourceFilter.addEventListener("input", updateToolSourceCatalog);
elements.toolSourceStatusFilter.addEventListener("change", updateToolSourceCatalog);
for (const input of [
  elements.toolSourceEditorName,
  elements.toolSourceEditorPath,
  elements.toolSourceEditorPriority,
  elements.toolSourceEditorInstruction
]) {
  input.addEventListener("input", syncToolSourceEditor);
}
for (const input of [
  elements.toolSourceEditorIncludeDocs,
  elements.toolSourceEditorEnabled
]) {
  input.addEventListener("change", syncToolSourceEditor);
}
elements.toolSourceScanRecursive.addEventListener("change", syncToolSourceScanRecursive);
elements.toolSourceOverviewTab.addEventListener("click", () => setToolSourceSection("overview"));
elements.toolSourceToolsTab.addEventListener("click", () => setToolSourceSection("tools"));
elements.toolSourceDocumentsTab.addEventListener("click", () => setToolSourceSection("documents"));
elements.toolSourceInstructionTab.addEventListener("click", () => setToolSourceSection("instruction"));
elements.toolSourceEditorPath.addEventListener("blur", () => {
  const row = toolSourceRowById();
  if (row) {
    validatePathRows([row]);
  }
});
for (const [index, tab] of [
  elements.toolSourceOverviewTab,
  elements.toolSourceToolsTab,
  elements.toolSourceDocumentsTab,
  elements.toolSourceInstructionTab
].entries()) {
  tab.addEventListener("keydown", (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const tabs = [
      elements.toolSourceOverviewTab,
      elements.toolSourceToolsTab,
      elements.toolSourceDocumentsTab,
      elements.toolSourceInstructionTab
    ];
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
      ? tabs.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const sections = ["overview", "tools", "documents", "instruction"];
    setToolSourceSection(sections[nextIndex], true);
  });
}
for (const input of [elements.toolGrantFilter, elements.toolGrantStatusFilter]) {
  input.addEventListener(input.tagName === "SELECT" ? "change" : "input", renderToolSourceGrants);
}
for (const input of [elements.toolGrantEditorName, elements.toolGrantEditorPriority]) {
  input.addEventListener("input", syncToolGrantEditor);
}
elements.toolGrantEditorEnabled.addEventListener("change", () => {
  syncToolGrantEditor();
  renderToolSourceGrants();
});
elements.enableVisibleToolGrants.addEventListener("click", () => setVisibleToolGrantsEnabled(true));
elements.disableVisibleToolGrants.addEventListener("click", () => setVisibleToolGrantsEnabled(false));
elements.copyToolGrantPath.addEventListener("click", () => {
  const record = selectedToolGrantRecord();
  if (record) {
    copyLocalPath(record.entry.path);
  }
});
elements.deleteToolGrant.addEventListener("click", removeSelectedToolGrant);
elements.deleteToolSource.addEventListener("click", () => {
  toolSourceRowById()?.querySelector('[data-action="remove"]').click();
});
elements.toolSourceScanTool.addEventListener("click", () => {
  const row = toolSourceRowById();
  if (row) {
    runFolderScan(row, "tool");
  }
});
elements.toolSourceScanDocument.addEventListener("click", () => {
  const row = toolSourceRowById();
  if (row) {
    runFolderScan(row, "document");
  }
});
for (const input of [elements.toolExactEditorName, elements.toolExactEditorPath, elements.toolExactEditorPriority]) {
  input.addEventListener("input", syncToolExactEditor);
}
elements.toolExactEditorPath.addEventListener("blur", () => {
  const row = toolExactRowById();
  if (row) {
    validatePathRows([row]);
  }
});
elements.toolExactEditorEnabled.addEventListener("change", syncToolExactEditor);
elements.deleteToolExact.addEventListener("click", () => {
  toolExactRowById()?.querySelector('[data-action="remove"]').click();
});
elements.promptCatalogFilter.addEventListener("input", updatePromptCatalog);
elements.promptStatusFilter.addEventListener("change", updatePromptCatalog);
for (const input of [
  elements.promptEditorName,
  elements.promptEditorKeywords,
  elements.promptEditorContent
]) {
  input.addEventListener("input", syncPromptEditor);
}
elements.promptEditorEnabled.addEventListener("change", syncPromptEditor);
elements.focusPromptEditor.addEventListener("click", () => setPromptFocusMode(!state.promptFocusMode));

elements.secretCatalogFilter.addEventListener("input", updateSecretCatalog);
elements.secretStatusFilter.addEventListener("change", updateSecretCatalog);
for (const input of [elements.secretEditorName, elements.secretEditorPath]) {
  input.addEventListener("input", syncSecretInspector);
}
elements.secretEditorPath.addEventListener("blur", () => {
  const row = secretRowById();
  if (row) {
    validatePathRows([row]);
  }
});
elements.secretEditorFormat.addEventListener("change", syncSecretInspector);
elements.secretEditorEnabled.addEventListener("change", syncSecretInspector);
elements.deleteSecretFile.addEventListener("click", () => {
  secretRowById()?.querySelector('[data-action="remove"]').click();
});

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

elements.documentGrantFilter.addEventListener("input", updateDocumentGrantCatalog);
elements.documentGrantTypeFilter.addEventListener("change", updateDocumentGrantCatalog);
elements.documentGrantStatusFilter.addEventListener("change", updateDocumentGrantCatalog);
for (const input of [
  elements.documentEditorName,
  elements.documentEditorPath,
  elements.documentEditorPriority
]) {
  input.addEventListener("input", syncDocumentGrantEditor);
}
elements.documentEditorPath.addEventListener("blur", () => {
  const row = documentGrantRowById();
  if (row) {
    validatePathRows([row]);
  }
});
elements.documentEditorEnabled.addEventListener("change", syncDocumentGrantEditor);
elements.deleteDocumentGrant.addEventListener("click", () => {
  documentGrantRowById()?.querySelector('[data-action="remove"]').click();
});

elements.addFolder.addEventListener("click", () => {
  elements.documentGrantFilter.value = "";
  elements.documentGrantTypeFilter.value = "all";
  elements.documentGrantStatusFilter.value = "all";
  const row = appendRoot({ name: uniqueRootName(`allowed-folder-${documentGrantRowsByKind("directory").length + 1}`), path: "", priority: 100 });
  selectDocumentGrant(row, { focus: true });
  markDirty();
});
elements.addFile.addEventListener("click", () => {
  elements.documentGrantFilter.value = "";
  elements.documentGrantTypeFilter.value = "all";
  elements.documentGrantStatusFilter.value = "all";
  const name = uniqueDocumentFileName(`document-file-${documentGrantRowsByKind("file").length + 1}`);
  const row = appendFile({ name, path: "" });
  selectDocumentGrant(row, { focus: true });
  markDirty();
});
elements.addToolFolder.addEventListener("click", () => {
  elements.toolSourceFilter.value = "";
  elements.toolSourceStatusFilter.value = "all";
  const name = uniqueToolDirectoryName(`tool-folder-${elements.toolDirectoriesList.children.length + 1}`);
  const row = appendToolDirectory({ name, path: "", priority: 100, recursive: true, includeDocs: true });
  selectToolSource(row, { focus: true });
  markDirty();
});
elements.addToolFile.addEventListener("click", () => {
  const name = uniqueToolFileName(`tool-file-${elements.toolFilesList.children.length + 1}`);
  const row = appendToolFile({ name, path: "", priority: 100 });
  elements.toolExactGrants.open = true;
  selectToolExact(row, { focus: true });
  markDirty();
});
elements.addSecretFile.addEventListener("click", () => {
  elements.secretCatalogFilter.value = "";
  elements.secretStatusFilter.value = "all";
  const name = uniqueSecretName(`secret-file-${secretRows().length + 1}`);
  const row = appendSecretFile({ name, path: "", format: "auto" });
  selectSecret(row, { focus: true });
  markDirty();
});
elements.addPrompt.addEventListener("click", () => {
  elements.promptCatalogFilter.value = "";
  elements.promptStatusFilter.value = "all";
  updatePromptCatalog();
  const name = uniquePromptName(`reusable-prompt-${elements.promptsList.children.length + 1}`);
  appendPrompt({ name, content: "", enabled: true }, { select: true, focusEditor: true });
  markDirty();
});
elements.duplicatePrompt.addEventListener("click", () => {
  const row = promptRowById();
  if (!row) {
    return;
  }
  const name = row.querySelector('[data-field="name"]').value.trim() || "reusable-prompt";
  const duplicate = appendPrompt({
    name: uniquePromptName(`${name}-copy`),
    keywords: row.querySelector('[data-field="keywords"]').value,
    content: row.querySelector('[data-field="content"]').value,
    enabled: row.querySelector('[data-field="enabled"]').checked
  }, { select: true, focusEditor: true });
  duplicate.scrollIntoView({ block: "nearest" });
  markDirty();
});
elements.deletePrompt.addEventListener("click", () => {
  const row = promptRowById();
  row?.querySelector('[data-action="remove"]').click();
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
elements.helpTab.addEventListener("click", () => activateTab("help"));
for (const button of document.querySelectorAll("[data-guide-tab]")) {
  button.addEventListener("click", () => activateTab(button.dataset.guideTab, true));
}
const tabOrder = ["prompts", "documents", "tools", "secrets", "help"];
const tabElements = [elements.promptsTab, elements.documentsTab, elements.toolsTab, elements.secretsTab, elements.helpTab];
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

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (state.dirty && !elements.saveConfig.disabled) {
      saveConfig();
    } else if (!state.dirty) {
      showToast("There are no unsaved changes.");
    }
    return;
  }
  if (event.key === "Escape" && state.promptFocusMode) {
    setPromptFocusMode(false);
  }
});

elements.configPath.textContent = runtime.configPath;
activateTab("prompts");
loadConfig();
