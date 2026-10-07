import assert from "node:assert/strict";
import { test } from "node:test";
import { topicChronicle } from "../module.ts";

test("the chronicle admin navigation resolves inside the admin route namespace", () => {
  const pages = topicChronicle.adminPages ?? [];
  assert.ok(pages.some((page) => page.path === "admin/topic-chronicle"));
  for (const page of pages) assert.match(page.path, /^admin\//);
});
