export class AgentDocError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "AgentDocError";
    this.code = code;
    this.details = details;
  }
}

export function errorPayload(error) {
  if (error instanceof AgentDocError) {
    return {
      schemaVersion: "1.0",
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
      }
    };
  }

  return {
    schemaVersion: "1.0",
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unexpected local documentation search failure."
    }
  };
}
