import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEDIA_FALLBACK,
  MEDIA_MAX_H,
  MEDIA_MAX_W,
  charsPerLine,
  estimateRow,
  mediaBox,
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
