import { errorPayload } from "./errors.mjs";

export function successToolResult(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload
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
