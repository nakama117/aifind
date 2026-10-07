import assert from "node:assert/strict";
import { test } from "node:test";
import { previewEnvironment } from "../scripts/preview-config.ts";

test("preview refuses remote or non-preview databases before any writes", () => {
  for (const url of ["postgres://localhost/production", "postgres://db.example.com/site_preview", "postgres://localhost/site_test"]) {
    assert.throws(() => previewEnvironment(url, {}), /local.*_preview/);
  }
});

test("preview overrides inherited collection, paid calls and pushes and binds loopback", () => {
  const env = previewEnvironment("postgres://postgres@127.0.0.1:55432/aisignal_preview", {
    MODEL_CALLS_ENABLED: "true", COLLECT_ENABLED: "true", FEISHU_INTERNAL_ENABLED: "true", WEB_HOST: "0.0.0.0",
  });
  assert.equal(env.MODEL_CALLS_ENABLED, "false");
  assert.equal(env.COLLECT_ENABLED, "false");
  assert.equal(env.FEISHU_INTERNAL_ENABLED, "false");
  assert.equal(env.INDEXNOW_SUBMIT_ENABLED, "false");
  assert.equal(env.WEB_HOST, "127.0.0.1");
  assert.equal(env.API_HOST, "127.0.0.1");
  assert.equal(env.SITE_PREVIEW, "true");
});
