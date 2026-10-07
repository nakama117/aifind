import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";

test("environment initialization preserves a provisioned key and never prints credentials", () => {
  const dir = mkdtempSync(join(tmpdir(), "aisignal-env-"));
  try {
    writeFileSync(join(dir, ".env.example"), readFileSync(".env.example"));
    writeFileSync(join(dir, ".env"), 'OPENAI_API_KEY="local-test-secret"\nCUSTOM_SETTING=keep\n');
    const run = () => spawnSync(process.execPath, [resolve("scripts/init-env.ts")], { cwd: dir, encoding: "utf8" });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const text = readFileSync(join(dir, ".env"), "utf8");
    const env = parseEnv(text);
    assert.equal(env.OPENAI_API_KEY, "local-test-secret");
    assert.equal(env.CUSTOM_SETTING, "keep");
    for (const key of ["ADMIN_PASSWORD", "SESSION_SECRET", "IMG_PROXY_SIGN_SECRET", "POSTGRES_PASSWORD"]) {
      assert.ok(env[key] && env[key].length >= 16, key);
      assert.ok(!first.stdout.includes(env[key]!), "credentials stay in the file");
    }
    assert.equal(env.MODEL_CALLS_ENABLED, "false");
    assert.equal(env.COLLECT_ENABLED, "false");
    assert.ok(!first.stdout.includes(env.OPENAI_API_KEY!));
    assert.equal(run().status, 0);
    assert.equal(readFileSync(join(dir, ".env"), "utf8"), text, "second run is stable");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
