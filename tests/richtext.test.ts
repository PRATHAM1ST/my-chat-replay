import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeletedMessage, parseCallLine, splitFormatRuns } from "../src/lib/whatsapp/richtext";

const flat = (runs: ReturnType<typeof splitFormatRuns>) =>
  runs.map((r) => [r.text, r.bold ?? false, r.italic ?? false, r.strike ?? false, r.mono ?? false]);

test("bold, italic and strike render without their markers", () => {
  assert.deepEqual(flat(splitFormatRuns("a *b* c")), [
    ["a ", false, false, false, false],
    ["b", true, false, false, false],
    [" c", false, false, false, false],
  ]);
  assert.equal(splitFormatRuns("_it_")[0]?.italic, true);
  assert.equal(splitFormatRuns("~no~")[0]?.strike, true);
});

test("styles nest in either order", () => {
  const a = splitFormatRuns("_*both*_").find((r) => r.text === "both");
  assert.ok(a?.bold && a?.italic);
  const b = splitFormatRuns("*_both_*").find((r) => r.text === "both");
  assert.ok(b?.bold && b?.italic);
});

test("maths and snake_case stay literal", () => {
  assert.deepEqual(flat(splitFormatRuns("5*3=15 and 2*2=4")), [
    ["5*3=15 and 2*2=4", false, false, false, false],
  ]);
  assert.deepEqual(flat(splitFormatRuns("file_name_here")), [
    ["file_name_here", false, false, false, false],
  ]);
});

test("a run may not start or end on a space", () => {
  assert.deepEqual(flat(splitFormatRuns("a * b* c")), [["a * b* c", false, false, false, false]]);
});

test("pairs do not span lines, except monospace", () => {
  assert.deepEqual(flat(splitFormatRuns("*a\nb*")), [["*a\nb*", false, false, false, false]]);
  const mono = splitFormatRuns("```a\nb```")[0];
  assert.equal(mono?.mono, true);
  assert.equal(mono?.text, "a\nb");
});

test("monospace contents stay raw", () => {
  const runs = splitFormatRuns("```*not bold*```");
  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.text, "*not bold*");
  assert.equal(runs[0]?.mono, true);
});

test("unmatched markers stay as typed", () => {
  assert.deepEqual(flat(splitFormatRuns("*open ended")), [
    ["*open ended", false, false, false, false],
  ]);
});

test("call lines parse; ordinary sentences do not", () => {
  assert.deepEqual(parseCallLine("Missed voice call"), {
    video: false,
    missed: true,
    label: "Missed voice call",
    sub: null,
  });
  assert.deepEqual(parseCallLine("Video call, 12 secs"), {
    video: true,
    missed: false,
    label: "Video call",
    sub: "12 secs",
  });
  assert.equal(parseCallLine("video call me later"), null);
  assert.equal(parseCallLine("nice video call today"), null);
});

test("deleted-message lines are recognised", () => {
  assert.ok(isDeletedMessage("This message was deleted"));
  assert.ok(isDeletedMessage("You deleted this message."));
  assert.ok(!isDeletedMessage("deleted the file"));
});
