import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReplies, serializeReplies, withLink, withoutLink } from "../src/lib/whatsapp/replies";

test("links round-trip through storage", () => {
  const links = withLink(withLink(new Map(), 10, 4), 42, 7);
  const back = parseReplies(serializeReplies(links));
  assert.equal(back.get(10), 4);
  assert.equal(back.get(42), 7);
  assert.equal(back.size, 2);
});

test("linking never mutates and re-linking overwrites", () => {
  const a = withLink(new Map(), 5, 1);
  const b = withLink(a, 5, 2);
  assert.equal(a.get(5), 1);
  assert.equal(b.get(5), 2);
});

test("self-links and negatives are refused", () => {
  assert.equal(withLink(new Map(), 5, 5).size, 0);
  assert.equal(withLink(new Map(), -1, 2).size, 0);
  assert.equal(withLink(new Map(), 2, -1).size, 0);
});

test("unlinking removes exactly one entry", () => {
  const links = withLink(withLink(new Map(), 1, 0), 2, 0);
  const next = withoutLink(links, 1);
  assert.equal(next.has(1), false);
  assert.equal(next.get(2), 0);
});

test("malformed storage reads as no links", () => {
  assert.equal(parseReplies(null).size, 0);
  assert.equal(parseReplies("junk").size, 0);
  assert.equal(parseReplies("[1,2]").size, 0);
  const filtered = parseReplies('{"3":3,"x":1,"4":"y","5":2,"-2":0}');
  assert.equal(filtered.size, 1);
  assert.equal(filtered.get(5), 2);
});
