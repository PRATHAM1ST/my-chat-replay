import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStars, serializeStars, withToggled } from "../src/lib/whatsapp/stars";

test("toggle adds and removes without mutating the original", () => {
  const a = new Set([1, 5]);
  const b = withToggled(a, 9);
  assert.deepEqual([...b].sort(), [1, 5, 9]);
  assert.deepEqual([...a].sort(), [1, 5]);
  const c = withToggled(b, 5);
  assert.deepEqual([...c].sort(), [1, 9]);
});

test("serialisation round-trips and sorts", () => {
  const stars = new Set([42, 3, 17]);
  assert.equal(serializeStars(stars), "[3,17,42]");
  assert.deepEqual(
    [...parseStars(serializeStars(stars))].sort((x, y) => x - y),
    [3, 17, 42],
  );
});

test("malformed storage never throws", () => {
  assert.equal(parseStars(null).size, 0);
  assert.equal(parseStars("").size, 0);
  assert.equal(parseStars("not json").size, 0);
  assert.equal(parseStars('{"a":1}').size, 0);
  // junk entries are dropped, valid ones kept
  assert.deepEqual([...parseStars('[1,"x",-4,2.5,7]')], [1, 7]);
});

test("empty set serialises to an empty list", () => {
  assert.equal(serializeStars(new Set()), "[]");
});
