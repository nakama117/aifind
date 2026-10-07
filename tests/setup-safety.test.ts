// The harness must ignore a workstation's closed model valve only for local test providers;
// production keeps its valve, and unmocked external HTTP must never leave the test process.
import { pointModels, stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, test } from "node:test";
import { getGlobalDispatcher, MockAgent } from "undici";
import { z } from "zod";
import { closeDb } from "@aihot/backend/db";
import { chatJson } from "@aihot/backend/providers/llm";

after(closeDb);

test("the harness permits a local fake model even when the parent model valve is closed", async () => {
  const provider = await stub(() => ({ choices: [{ message: { content: '{"ok":true}' } }] }));
  const previous = { base: process.env.DEEPSEEK_BASE_URL, key: process.env.DEEPSEEK_API_KEY };
  try {
    pointModels(provider.url, ["deepseek-flash"]);
    const answer = await chatJson({ model: "deepseek-flash", purpose: "invariant_test", subject: `setup-${tag()}`,
      promptVersion: "test", system: "Return the local fixture", user: "test", schema: z.object({ ok: z.boolean() }) });
    assert.deepEqual(answer.data, { ok: true });
    assert.equal(provider.hits(), 1);
  } finally {
    if (previous.base === undefined) delete process.env.DEEPSEEK_BASE_URL; else process.env.DEEPSEEK_BASE_URL = previous.base;
    if (previous.key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previous.key;
    await provider.close();
  }
});

test("production still rejects model calls with its valve closed", () => {
  const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import { config } from '@aihot/backend/config';
    import { chatJson } from '@aihot/backend/providers/llm';
    import { z } from 'zod';
    try {
      await chatJson({ model: 'deepseek-flash', purpose: 'invariant_test', subject: 'closed', promptVersion: 'test',
        system: '', user: 'test', schema: z.object({}) });
      process.exitCode = 1;
    } catch (error) {
      console.log(JSON.stringify({ enabled: config.modelCallsEnabled, error: error.message }));
    }
  `], { encoding: "utf8", env: { ...process.env, MODEL_CALLS_ENABLED: "false" } });
  assert.deepEqual(JSON.parse(result), { enabled: false, error: "Model calls are disabled (MODEL_CALLS_ENABLED=false)" });
});

test("model fixture configuration rejects addresses outside loopback", () => {
  const env: NodeJS.ProcessEnv = {};
  for (const address of ["https://api.openai.com", "http://127.0.0.1.example.com", "http://127.0.0.1@api.openai.com", "https://localhost"]) {
    assert.throws(() => pointModels(address, ["deepseek-flash"], env), /local HTTP stub/);
  }
  assert.deepEqual(env, {});
});

test("unmocked OpenAI, X, Jina and Feishu HTTP cannot leave the harness", async () => {
  // Keep the RED run offline too: stop before attempting HTTP if the guard has not been installed.
  assert.ok(getGlobalDispatcher() instanceof MockAgent, "the harness must install its network guard first");
  for (const url of ["https://api.openai.com/v1/responses", "https://api.socialdata.tools/twitter/search",
    "https://r.jina.ai/https://example.org", "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"]) {
    await assert.rejects(fetch(url), (error: unknown) =>
      (error as { cause?: { code?: string } }).cause?.code === "UND_MOCK_ERR_MOCK_NOT_MATCHED");
  }
});
