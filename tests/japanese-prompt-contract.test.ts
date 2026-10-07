import './setup.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTITIES, ENTITY_TAGS, IDENTITY_LEXICON } from '@aihot/industry/taxonomy';
import { isJapaneseText } from '@aihot/contracts/language';
import { UNDERSTAND_SYSTEM } from '@aihot/backend/editorial/writing';
import { STRUCTURE_SYSTEM } from '@aihot/backend/editorial/analyze';

test('the prompts actually sent to understand and structure share the configured entity whitelist', () => {
  for (const prompt of [UNDERSTAND_SYSTEM, STRUCTURE_SYSTEM]) {
    const whitelist = prompt.match(/^- 实体：(.+)$/m)?.[1]?.trim().split('、');
    assert.deepEqual(whitelist, [...ENTITY_TAGS]);
    assert.doesNotMatch(prompt, /\{\{entityTags\}\}/);
  }
});

test('the understanding JSON example passes the same Japanese text gate as public titles and summaries', () => {
  const line = UNDERSTAND_SYSTEM.split('\n').find(line => line.startsWith('{"itemType":'));
  assert.ok(line, 'the complete six-field output example is present');
  const example = JSON.parse(line);
  assert.deepEqual(Object.keys(example).sort(), ['authorRole', 'editorialJudgment', 'itemType', 'summaryZh', 'tags', 'titleZh']);
  for (const field of ['titleZh', 'summaryZh', 'editorialJudgment']) {
    assert.ok(isJapaneseText(example[field]), `${field} must illustrate Japanese output`);
  }
});

test('existing Japanese company aliases resolve to the same configured entity and allowed display tag', () => {
  for (const [alias, id] of [
    ['サカナAI', 'sakana-ai'], ['PFN', 'preferred-networks'], ['PLaMo', 'preferred-networks'],
    ['プリファードネットワークス', 'preferred-networks'], ['GENIAC', 'geniac'], ['理研AIP', 'riken-aip'],
  ]) {
    assert.equal(IDENTITY_LEXICON.find(entity => entity.patterns.some(pattern => pattern.test(alias!)))?.id, id);
    assert.ok(ENTITIES[id!]!.aliases.includes(alias!));
    assert.ok((ENTITY_TAGS as readonly string[]).includes(ENTITIES[id!]!.displayTag!));
  }
});
