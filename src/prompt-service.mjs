import { performance } from "node:perf_hooks";

import { loadConfig, MAX_PROMPT_NAME_CHARS } from "./config.mjs";
import { AgentDocError } from "./errors.mjs";
import { canonicalize, countLines, createQueryPlan, sha256 } from "./text.mjs";

const PREVIEW_CHARACTERS = 240;

function promptPreview(content) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length <= PREVIEW_CHARACTERS
    ? compact
    : `${compact.slice(0, PREVIEW_CHARACTERS - 1).trimEnd()}…`;
}

function scorePrompt(prompt, queryPlan, caseSensitive) {
  const name = canonicalize(prompt.name, caseSensitive);
  const keywords = prompt.keywords.map((keyword) => canonicalize(keyword, caseSensitive));
  const keywordText = keywords.join(" ");
  const matchedTerms = queryPlan.terms.filter((term) => name.includes(term) || keywordText.includes(term));
  if (matchedTerms.length !== queryPlan.terms.length) {
    return null;
  }

  const nameMatchedTerms = queryPlan.terms.filter((term) => name.includes(term));
  const keywordMatchedTerms = queryPlan.terms.filter((term) => keywordText.includes(term));
  const allTermsMatched = matchedTerms.length === queryPlan.terms.length;
  const exactName = name === queryPlan.normalizedQuery;
  const nameContainsQuery = name.includes(queryPlan.normalizedQuery);
  const exactKeyword = keywords.includes(queryPlan.normalizedQuery);
  const allTermsInName = nameMatchedTerms.length === queryPlan.terms.length;
  return {
    score: (exactName ? 1_000 : 0)
      + (nameContainsQuery ? 500 : 0)
      + (exactKeyword ? 400 : 0)
      + (allTermsInName ? 300 : 0)
      + (allTermsMatched ? 200 : 0)
      + (nameMatchedTerms.length * 30)
      + (keywordMatchedTerms.length * 20),
    matchedTerms,
    matchedFields: [
      ...(nameMatchedTerms.length > 0 ? ["name"] : []),
      ...(keywordMatchedTerms.length > 0 ? ["keywords"] : [])
    ],
    allTermsMatched
  };
}

export async function findPrompts({ query, maxResults = undefined }, options = {}) {
  if (typeof query !== "string" || !query.trim()) {
    throw new AgentDocError("PROMPT_QUERY_EMPTY", "Prompt query is required.");
  }
  if (query.length > 500) {
    throw new AgentDocError("PROMPT_QUERY_TOO_LONG", "Prompt query must be 500 characters or fewer.");
  }
  if (maxResults !== undefined && (!Number.isInteger(maxResults) || maxResults < 1)) {
    throw new AgentDocError("PROMPT_RESULT_LIMIT_INVALID", "Prompt result limit must be a positive integer.");
  }

  const started = performance.now();
  const config = await loadConfig(options.configPath);
  const queryPlan = createQueryPlan(query, config.caseSensitive);
  const resultLimit = Math.min(maxResults ?? config.limits.maxResults, config.limits.maxResults);
  const results = [];

  for (const prompt of config.prompts.filter((candidate) => candidate.enabled)) {
    const match = scorePrompt(prompt, queryPlan, config.caseSensitive);
    if (!match) {
      continue;
    }
    results.push({
      name: prompt.name,
      keywords: prompt.keywords,
      preview: promptPreview(prompt.content),
      characterCount: prompt.content.length,
      lineCount: countLines(prompt.content),
      enabled: true,
      ...match
    });
  }

  results.sort((left, right) => (
    Number(right.allTermsMatched) - Number(left.allTermsMatched)
    || right.score - left.score
    || left.name.localeCompare(right.name)
  ));

  return {
    schemaVersion: "1.0",
    ok: true,
    query,
    queryPlan,
    results: results.slice(0, resultLimit),
    meta: {
      backend: "config-entry",
      indexed: false,
      networkUsed: false,
      configPath: config.configPath,
      elapsedMs: Math.round(performance.now() - started),
      promptsConfigured: config.prompts.length,
      promptsEnabled: config.prompts.filter((prompt) => prompt.enabled).length,
      promptsDisabled: config.prompts.filter((prompt) => !prompt.enabled).length,
      searchFields: ["name", "keywords"],
      matchMode: "all-terms",
      truncated: results.length > resultLimit,
      fullContentReturned: false
    }
  };
}

export async function readPrompt({ prompt }, options = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new AgentDocError("PROMPT_NAME_EMPTY", "Configured prompt name or alias is required.");
  }
  if (prompt.length > MAX_PROMPT_NAME_CHARS) {
    throw new AgentDocError("PROMPT_NAME_TOO_LONG", `Prompt name must be ${MAX_PROMPT_NAME_CHARS} characters or fewer.`);
  }

  const config = await loadConfig(options.configPath);
  const requestedName = prompt.trim();
  const entry = config.prompts.find((candidate) => candidate.name === requestedName)
    ?? config.prompts.find((candidate) => candidate.name.toLowerCase() === requestedName.toLowerCase());
  if (!entry) {
    throw new AgentDocError("PROMPT_NOT_CONFIGURED", `Prompt '${requestedName}' is not configured.`, {
      availableNames: config.prompts.filter((candidate) => candidate.enabled).map((candidate) => candidate.name)
    });
  }
  if (!entry.enabled) {
    throw new AgentDocError("PROMPT_DISABLED", `Prompt '${entry.name}' is disabled in the local configuration.`);
  }

  return {
    schemaVersion: "1.0",
    ok: true,
    name: entry.name,
    content: entry.content,
    characterCount: entry.content.length,
    lineCount: countLines(entry.content),
    sha256: sha256(Buffer.from(entry.content, "utf8")),
    meta: {
      localRead: true,
      networkUsed: false,
      storedInConfig: true
    }
  };
}
