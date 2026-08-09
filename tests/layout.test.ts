import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEDIA_FALLBACK,
  MEDIA_MAX_H,
  MEDIA_MAX_W,
  charsPerLine,
  estimateRow,
  mediaBox,
  stampWidth,
} from "../src/lib/whatsapp/layout";
import { initials, lowerBound, nameColor } from "../src/lib/whatsapp/format";
import { kindFromFileName, mimeFromFileName } from "../src/lib/whatsapp/types";
import type { Msg } from "../src/lib/whatsapp/types";

const msg = (over: Partial<Msg> = {}): Msg => ({
  i: 0,
  ts: Date.UTC(2024, 2, 12, 9, 0),
  s: 0,
  text: "",
  kind: "text",
  ...over,
});

const shape = (over = {}) => ({ newDay: false, showName: false, cpl: 70, ...over });

test("media boxes stay inside WhatsApp's cap", () => {
  const wide = mediaBox({ w: 4000, h: 3000 });
  assert.equal(wide.w, MEDIA_MAX_W);
  assert.ok(wide.h <= MEDIA_MAX_H);

  const tall = mediaBox({ w: 1000, h: 4000 });
  assert.equal(tall.h, MEDIA_MAX_H);
  assert.ok(tall.w >= 140);
});

test("media boxes preserve aspect ratio", () => {
  const box = mediaBox({ w: 1600, h: 1200 });
  assert.ok(Math.abs(box.w / box.h - 4 / 3) < 0.02);
});

test("a phone screenshot is narrowed to fit, never cropped away", () => {
  // 715x1600 is what a real WhatsApp export carries for a screenshot: too tall
  // to fill the media width, and the whole point is that it stays readable.
  const box = mediaBox({ w: 715, h: 1600 });
  assert.ok(box.h <= MEDIA_MAX_H);
  assert.ok(box.w < MEDIA_MAX_W, "a tall picture gives up width, not content");
  assert.ok(Math.abs(box.w / box.h - 715 / 1600) < 0.01, "and keeps its shape");
});

test("artwork too narrow to fit is the one case that still crops", () => {
  const sliver = mediaBox({ w: 200, h: 4000 });
  assert.equal(sliver.h, MEDIA_MAX_H);
  assert.equal(sliver.w, 140, "below the floor the sides go instead of the box");
});

test("the stamp reserves more room as it gains parts", () => {
  const plain = stampWidth({ time: "12:07" });
  assert.ok(plain > 30 && plain < 60);
  assert.ok(stampWidth({ time: "12:07", ticks: true }) > plain);
  assert.ok(stampWidth({ time: "12:07", starred: true }) > plain);
  assert.ok(stampWidth({ time: "12:07", edited: true }) > plain);
  assert.ok(stampWidth({ time: "12:07 pm" }) > plain, "a 12-hour clock is wider");
});

test("an unknown ratio falls back to a fixed slot", () => {
  assert.deepEqual(mediaBox(undefined), MEDIA_FALLBACK);
  assert.deepEqual(mediaBox({ w: 0, h: 0 }), MEDIA_FALLBACK);
});

test("wrap width tracks the pane and never goes silly", () => {
  assert.ok(charsPerLine(1200) > charsPerLine(600));
  assert.ok(charsPerLine(0) > 0);
  assert.ok(charsPerLine(10) >= 14);
});

test("longer text is estimated taller, and line breaks count", () => {
  const short = estimateRow(msg({ text: "hi" }), shape());
  const long = estimateRow(msg({ text: "x".repeat(400) }), shape());
  const broken = estimateRow(msg({ text: "a\nb\nc\nd" }), shape());
  assert.ok(long > short);
  assert.ok(broken > short);
});

test("the clock shares the last line whenever that line can spare the width", () => {
  const one = estimateRow(msg({ text: "hi" }), shape());
  // a line filled to the brim has nowhere to put the clock, so it costs a line
  const full = estimateRow(msg({ text: "x".repeat(70) }), shape());
  assert.equal(full - one, 19, "exactly one more line, not a whole extra bubble");

  // and the room it needs depends on what it prints: ticks push it over
  const tight = "x".repeat(63);
  assert.ok(
    estimateRow(msg({ text: tight }), shape({ outgoing: true, time: "12:07" })) >
      estimateRow(msg({ text: tight }), shape({ time: "12:07" })),
  );
});

test("a caption is measured against the picture's width, not the bubble's", () => {
  const short = estimateRow(
    msg({ kind: "image", file: "a.jpg", text: "nice" }),
    shape({ ratio: { w: 1200, h: 900 } }),
  );
  const long = estimateRow(
    msg({ kind: "image", file: "a.jpg", text: "nice ".repeat(40) }),
    shape({ ratio: { w: 1200, h: 900 } }),
  );
  assert.ok(long > short + 60, "a caption that wraps many times is many lines tall");
});

test("system notices are measured, not guessed at one line", () => {
  const notice =
    "Messages and calls are end-to-end encrypted. Only people in this chat can " +
    "read, listen to, or share them.";
  const phone = estimateRow(msg({ kind: "system", text: notice }), shape({ pane: 412 }));
  const desktop = estimateRow(msg({ kind: "system", text: notice }), shape({ pane: 1280 }));
  const brief = estimateRow(msg({ kind: "system", text: "Ann joined" }), shape({ pane: 412 }));
  assert.ok(phone > desktop, "a narrow pane wraps the notice further");
  assert.ok(brief < desktop, "a one-line event stays one line");
});

test("a day divider and a participant name add height", () => {
  const plain = estimateRow(msg({ text: "hi" }), shape());
  assert.ok(estimateRow(msg({ text: "hi" }), shape({ newDay: true })) > plain);
  assert.ok(estimateRow(msg({ text: "hi" }), shape({ showName: true })) > plain);
});

test("a known picture ratio drives the estimate", () => {
  const guess = estimateRow(msg({ kind: "image", file: "a.jpg" }), shape());
  const tall = estimateRow(
    msg({ kind: "image", file: "a.jpg" }),
    shape({ ratio: { w: 1000, h: 4000 } }),
  );
  assert.ok(tall > guess);
});

test("an attachment missing from the archive is a small row", () => {
  const present = estimateRow(msg({ kind: "image", file: "a.jpg" }), shape());
  const missing = estimateRow(msg({ kind: "image", label: "a.jpg" }), shape());
  assert.ok(missing < present);
});

test("every kind estimates to something sane", () => {
  for (const kind of [
    "text",
    "image",
    "video",
    "audio",
    "sticker",
    "document",
    "system",
  ] as const) {
    const h = estimateRow(msg({ kind, text: "hi", file: "a.bin" }), shape());
    assert.ok(h > 20 && h < 600, `${kind} -> ${h}`);
  }
  assert.equal(estimateRow(undefined, shape()), 64);
});

test("file kinds and mime types", () => {
  assert.equal(kindFromFileName("a.JPG"), "image");
  assert.equal(kindFromFileName("a.webp"), "sticker");
  assert.equal(kindFromFileName("a.mp4"), "video");
  assert.equal(kindFromFileName("a.opus"), "audio");
  assert.equal(kindFromFileName("a.pdf"), "document");
  assert.equal(kindFromFileName("noextension"), "document");
  assert.equal(mimeFromFileName("a.jpeg"), "image/jpeg");
  assert.equal(mimeFromFileName("a.unknown"), "application/octet-stream");
});

test("initials cope with one word, many words and emoji", () => {
  assert.equal(initials("Ann"), "A");
  assert.equal(initials("Ann Marie Smith"), "AS");
  assert.equal(initials("  "), "#");
  assert.equal(initials("+91 98765 43210"), "94");
  assert.equal(initials("🏔️ Trip"), "🏔T");
});

test("participant colours are stable and inside the palette", () => {
  for (let i = 0; i < 20; i++) {
    const slot = nameColor(i);
    assert.ok(slot >= 1 && slot <= 8);
  }
  assert.equal(nameColor(3), nameColor(3));
});

test("lowerBound finds the insertion point", () => {
  const list = new Int32Array([0, 4, 8, 12]);
  assert.equal(lowerBound(list, 0), 0);
  assert.equal(lowerBound(list, 5), 2);
  assert.equal(lowerBound(list, 12), 3);
  assert.equal(lowerBound(list, 99), 4);
  assert.equal(lowerBound(new Int32Array(0), 1), 0);
});
