import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReactions, serializeReactions, withReaction } from "../src/lib/whatsapp/reactions";

test("reactions round-trip through storage", () => {
  const reactions = withReaction(withReaction(new Map(), 4, "🙌"), 10, "❤️");
  const back = parseReactions(serializeReactions(reactions));
  assert.equal(back.get(4), "🙌");
  assert.equal(back.get(10), "❤️");
  assert.equal(back.size, 2);
});

test("reacting never mutates, re-reacting replaces, same emoji removes", () => {
  const a = withReaction(new Map(), 5, "👍");
  const b = withReaction(a, 5, "😂");
  const c = withReaction(b, 5, "😂");
  assert.equal(a.get(5), "👍");
  assert.equal(b.get(5), "😂");
  assert.equal(c.has(5), false);
});

test("null clears and whitespace or negatives are refused", () => {
  const set = withReaction(new Map(), 3, "👍");
  assert.equal(withReaction(set, 3, null).size, 0);
  assert.equal(withReaction(new Map(), 3, "   ").size, 0);
  assert.equal(withReaction(new Map(), -1, "👍").size, 0);
});

test("a ZWJ family and a flag both count as one emoji", () => {
  const set = withReaction(withReaction(new Map(), 1, "👨‍👩‍👧‍👦"), 2, "🇮🇳");
  const back = parseReactions(serializeReactions(set));
  assert.equal(back.get(1), "👨‍👩‍👧‍👦");
  assert.equal(back.get(2), "🇮🇳");
});

test("malformed storage reads as no reactions", () => {
  assert.equal(parseReactions(null).size, 0);
  assert.equal(parseReactions("junk").size, 0);
  assert.equal(parseReactions('["👍"]').size, 0);
  const filtered = parseReactions(
    `{"2":"👍","x":"❤️","3":7,"-1":"😂","4":"","5":"${"x".repeat(60)}"}`,
  );
  assert.equal(filtered.size, 1);
  assert.equal(filtered.get(2), "👍");
});
