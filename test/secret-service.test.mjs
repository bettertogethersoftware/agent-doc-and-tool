import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkConfiguration, fetchDocument, searchDocuments } from "../src/search-service.mjs";
import { findSecrets, inspectSecretPath, parseSecretText, readSecret } from "../src/secret-service.mjs";
import { findTools } from "../src/tool-service.mjs";

async function createSecretFixture(t) {
  const systemTemporaryRoot = await fs.realpath(os.tmpdir());
  const temporaryRoot = await fs.mkdtemp(path.join(systemTemporaryRoot, "agent-doc-secret-test-"));
  const envPath = path.join(temporaryRoot, "ftp-credentials.txt");
  const tokenPath = path.join(temporaryRoot, "service-token.txt");
  const readmePath = path.join(temporaryRoot, "README.md");
  const configPath = path.join(temporaryRoot, "search.config.json");

  await fs.writeFile(envPath, [
    "hostname=ftp.example.test",
    "username=fixture-user",
    "password=fixture-password-123",
    "quoted=\"value with spaces\" # local comment",
    ""
  ].join("\n"), "utf8");
  await fs.writeFile(tokenPath, "fixture-opaque-token-456\n", "utf8");
  await fs.writeFile(readmePath, "# Safe documentation\nNo credentials are stored here.\n", "utf8");

  const config = {
    version: 1,
    defaultSource: "local",
    sources: {
      local: {
        roots: [{ name: "secret-fixture", path: temporaryRoot, priority: 100 }],
        extensions: ".md;.txt",
        fileNames: ["README.md"],
        files: [{ name: "credential-document", path: envPath }]
      }
    },
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    tools: {
      directories: [{ name: "secret-fixture-tools", path: temporaryRoot, priority: 100, recursive: true, includeDocs: false }],
      files: [{ name: "credential-as-tool", path: envPath, priority: 100 }],
      extensions: ".txt"
    },
    secrets: {
      files: [
        { name: "fixture-ftp", path: envPath, format: "auto" },
        { name: "fixture-token", path: tokenPath, format: "opaque" }
      ],
      maxFileBytes: 100_000
    },
    limits: {
      maxResults: 20,
      maxMatchesPerFile: 3,
      maxLineChars: 1_000,
      maxFileBytes: 100_000,
      maxFetchBytes: 100_000,
      maxFiles: 1_000,
      timeoutMs: 5_000
    }
  };
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  t.after(async () => {
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedSystemTemp = systemTemporaryRoot;
    const relative = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  });

  return { configPath, envPath, tokenPath };
}

test("secret parser detects key/value and opaque files without interpolation", () => {
  const env = parseSecretText("HOST=ftp.example.test\nPASSWORD='abc 123'\nLITERAL=${NOT_EXPANDED}\n", {
    format: "auto",
    fileName: "ftp.txt"
  });
  assert.equal(env.format, "env");
  assert.deepEqual(env.entries, [
    { key: "HOST", value: "ftp.example.test" },
    { key: "PASSWORD", value: "abc 123" },
    { key: "LITERAL", value: "${NOT_EXPANDED}" }
  ]);

  const opaque = parseSecretText("-----BEGIN PUBLIC KEY-----\nfixture\n-----END PUBLIC KEY-----\n", {
    format: "auto",
    fileName: "public-key.pem"
  });
  assert.equal(opaque.format, "opaque");
  assert.match(opaque.value, /BEGIN PUBLIC KEY/);
});

test("secret inspection and discovery return paths and field names but no values", async (t) => {
  const fixture = await createSecretFixture(t);
  const inspected = await inspectSecretPath({ name: "fixture-ftp", path: fixture.envPath, format: "auto" });
  assert.equal(inspected.secret.format, "env");
  assert.deepEqual(inspected.secret.fields, ["hostname", "username", "password", "quoted"]);
  assert.equal(inspected.sensitiveValuesReturned, false);
  assert.doesNotMatch(JSON.stringify(inspected), /fixture-password-123|fixture-user/);

  const found = await findSecrets({ query: "hostname" }, { configPath: fixture.configPath });
  assert.equal(found.results[0].name, "fixture-ftp");
  assert.equal(found.results[0].path, fixture.envPath);
  assert.equal(found.meta.sensitiveValuesReturned, false);
  assert.doesNotMatch(JSON.stringify(found), /fixture-password-123|fixture-user/);

  const checked = await checkConfiguration({ configPath: fixture.configPath });
  assert.deepEqual(checked.secrets.files[0].fields, ["hostname", "username", "password", "quoted"]);
  assert.doesNotMatch(JSON.stringify(checked), /fixture-password-123|fixture-user/);
});

test("read_secret returns only requested fields or one opaque value", async (t) => {
  const fixture = await createSecretFixture(t);
  const selected = await readSecret({
    secret: "fixture-ftp",
    keys: ["hostname", "password"]
  }, { configPath: fixture.configPath });
  assert.equal(selected.sensitive, true);
  assert.deepEqual(selected.values, {
    hostname: "ftp.example.test",
    password: "fixture-password-123"
  });
  assert.equal(Object.hasOwn(selected.values, "username"), false);

  await assert.rejects(
    readSecret({ secret: "fixture-ftp" }, { configPath: fixture.configPath }),
    (error) => error?.code === "SECRET_KEYS_REQUIRED" && error?.details?.availableKeys.includes("password")
  );

  const opaque = await readSecret({ secret: "fixture-token" }, { configPath: fixture.configPath });
  assert.equal(opaque.value, "fixture-opaque-token-456");
  assert.equal(opaque.format, "opaque");
});

test("configured secret files are excluded from search, fetch, and tool discovery", async (t) => {
  const fixture = await createSecretFixture(t);

  const search = await searchDocuments({ query: "fixture-password-123", source: "local" }, { configPath: fixture.configPath });
  assert.equal(search.results.length, 0);

  await assert.rejects(
    fetchDocument({ path: fixture.envPath, source: "local" }, { configPath: fixture.configPath }),
    (error) => error?.code === "FETCH_PATH_PROTECTED"
  );

  const tools = await findTools({ query: "credential as tool" }, { configPath: fixture.configPath });
  assert.equal(tools.results.length, 0);
});
