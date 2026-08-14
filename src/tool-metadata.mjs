import path from "node:path";

export function toolMetadataFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  let type = "configured-file";
  let invocation = {
    kind: "unspecified",
    command: filePath,
    argumentsPrefix: [],
    requiresEnvironment: true
  };

  if ([".exe", ".com"].includes(extension)) {
    type = "executable";
    invocation = {
      kind: "direct",
      command: filePath,
      argumentsPrefix: [],
      requiresEnvironment: false
    };
  } else if ([".cmd", ".bat"].includes(extension)) {
    type = "batch-script";
    invocation = {
      kind: "command-shell",
      command: filePath,
      argumentsPrefix: [],
      requiresEnvironment: true
    };
  } else if (extension === ".ps1") {
    type = "powershell-script";
    invocation = {
      kind: "powershell",
      command: "powershell",
      argumentsPrefix: ["-NoProfile", "-File", filePath],
      requiresEnvironment: true
    };
  } else if (extension === ".py") {
    type = "python-script";
    invocation = {
      kind: "python",
      command: "python",
      argumentsPrefix: [filePath],
      requiresEnvironment: true
    };
  } else if ([".js", ".mjs", ".cjs"].includes(extension)) {
    type = "node-script";
    invocation = {
      kind: "node",
      command: "node",
      argumentsPrefix: [filePath],
      requiresEnvironment: true
    };
  }

  return {
    workingDirectory: path.dirname(filePath),
    extension,
    type,
    invocation
  };
}
