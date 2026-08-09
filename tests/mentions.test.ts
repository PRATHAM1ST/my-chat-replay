import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMentionRegex, splitMentions } from "../src/lib/whatsapp/mentions";

const NAMES = ["Aarav Shah", "Priya", "Ann", "Ann Marie", "+91 98765 43210"];

test("a participant name with spaces is matched as one mention", () => {
  const re = buildMentionRegex(NAMES);
  const segs = splitMentions("hey @Aarav Shah are you in?", re);
  assert.deepEqual(
    segs.map((s) => [s.text, s.mention]),
    [
      ["hey ", false],
      ["@Aarav Shah", true],
      [" are you in?", false],
    ],
  );
});

test("the longest participant name wins", () => {
  const re = buildMentionRegex(NAMES);
  const segs = splitMentions("@Ann Marie ok", re);
  assert.equal(segs[0]?.text, "@Ann Marie");
  assert.equal(segs[0]?.mention, true);
});

test("unknown handles still highlight via the fallback", () => {
  const re = buildMentionRegex(NAMES);
  const segs = splitMentions("ping @rahul_07 now", re);
  assert.deepEqual(segs[1], { text: "@rahul_07", mention: true });
});

test("email addresses are not mentions", () => {
  const re = buildMentionRegex(NAMES);
  const segs = splitMentions("mail me at ann@example.com", re);
  assert.ok(segs.every((s) => !s.mention));
});

test("regex specials in names neither throw nor mismatch", () => {
  const re = buildMentionRegex(["A+B (test)", "Priya"]);
  assert.ok(re);
  const segs = splitMentions("cc @A+B (test) done", re);
  assert.deepEqual(segs[1], { text: "@A+B (test)", mention: true });
});

test("text without @ takes the fast path untouched", () => {
  const re = buildMentionRegex(NAMES);
  assert.deepEqual(splitMentions("no mentions here", re), [
    { text: "no mentions here", mention: false },
  ]);
});

test("multiple mentions in one message", () => {
  const re = buildMentionRegex(NAMES);
  const segs = splitMentions("@Priya @Ann see this", re);
  assert.equal(segs.filter((s) => s.mention).length, 2);
});
