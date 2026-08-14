import { errorPayload } from "./errors.mjs";

function discoveryPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  if (payload.meta?.executed === true) {
    throw new Error("Discovery MCP responses cannot report executed work.");
  }
  return {
    ...payload,
    meta: {
      ...(payload.meta ?? {}),
      executed: false
    }
  };
}

export function successToolResult(payload) {
  const result = discoveryPayload(payload);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result
  };
}

export function errorToolResult(error) {
  const payload = errorPayload(error);
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError: true
  };
}
