import crypto from "node:crypto";

import { AgentDocError } from "./errors.mjs";

function decodeUtf16BigEndian(buffer) {
  const swapped = Buffer.allocUnsafe(buffer.length - 2);
  for (let index = 2; index + 1 < buffer.length; index += 2) {
    swapped[index - 2] = buffer[index + 1];
    swapped[index - 1] = buffer[index];
  }
  return swapped.toString("utf16le");
}

export function decodeText(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { binary: false, encoding: "utf-16le", hasBom: true, text: buffer.subarray(2).toString("utf16le") };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { binary: false, encoding: "utf-16be", hasBom: true, text: decodeUtf16BigEndian(buffer) };
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (sample.includes(0)) {
    return { binary: true, encoding: null, hasBom: false, text: null };
  }

  const hasUtf8Bom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  return {
    binary: false,
    encoding: "utf-8",
    hasBom: hasUtf8Bom,
    text: buffer.subarray(hasUtf8Bom ? 3 : 0).toString("utf8")
  };
}

export function canonicalize(value, caseSensitive = false) {
  const normalized = value.normalize("NFKC");
  const cased = caseSensitive ? normalized : normalized.toLocaleLowerCase("en-US");
  return cased
    .replace(/[\p{P}\p{S}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createQueryPlan(query, caseSensitive = false) {
  const normalizedQuery = canonicalize(query.trim(), caseSensitive);
  if (!normalizedQuery) {
    throw new AgentDocError("QUERY_EMPTY", "Search query must contain letters or numbers.");
  }

  const terms = [];
  for (const token of normalizedQuery.split(" ")) {
    const pieces = token.match(/[\p{L}]+\d+|[\p{L}]+|\d+/gu) ?? [token];
    const usefulPieces = pieces.length > 1 && pieces.join("") === token ? pieces : [token];
    for (const piece of usefulPieces) {
      if (piece && !terms.includes(piece)) {
        terms.push(piece);
      }
    }
  }

  return { normalizedQuery, terms };
}

export function splitLines(text) {
  return text.split(/\r\n|\n|\r/);
}

export function countLines(text) {
  if (text.length === 0) {
    return 0;
  }
  return (text.match(/\r\n|\n|\r/g) ?? []).length + 1;
}

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
