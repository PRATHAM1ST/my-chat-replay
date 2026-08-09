import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDay, formatTime } from "../src/lib/whatsapp/format";

const DAY = 86400000;

test("the meridiem is lowercase, the way WhatsApp writes it", () => {
  const stamp = formatTime(new Date(2026, 6, 23, 14, 5).getTime());
  assert.ok(!/[AP]M/.test(stamp), stamp);
});

test("date pills spell the month out and stay sentence case", () => {
  const old = formatDay(new Date(2024, 0, 5).getTime());
  assert.match(old, /January/);
  assert.match(old, /2024/);
});

test("today and yesterday keep their names", () => {
  assert.equal(formatDay(Date.now()), "Today");
  assert.equal(formatDay(Date.now() - DAY), "Yesterday");
});

test("the transcript follows the exporting phone's clock", async () => {
  const { setClockStyle } = await import("../src/lib/whatsapp/format");
  const afternoon = new Date(2026, 6, 23, 14, 5).getTime();
  setClockStyle(false);
  assert.equal(formatTime(afternoon), "14:05");
  setClockStyle(true);
  assert.match(formatTime(afternoon), /^2:05\spm$/);
  setClockStyle(undefined);
});
