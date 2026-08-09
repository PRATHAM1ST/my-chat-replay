import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChat } from "../src/lib/whatsapp/parse";

/**
 * Every fixture here is a shape a real WhatsApp export actually produces.
 * WhatsApp writes the transcript in the phone's locale, so the header line
 * varies far more than the docs suggest: separator, date order, clock, the
 * spelling of AM/PM and the invisible marks around them all move.
 */

const LRM = "‎"; // left-to-right mark, sprinkled through iOS exports
const NNBSP = " "; // narrow no-break space before AM/PM on iOS 17+

test("android 24-hour, day-first", () => {
  const chat = parseChat("12/03/2024, 14:22 - Ann: hello there");
  const m = chat.messages[0];
  assert.equal(chat.messages.length, 1);
  assert.equal(m?.text, "hello there");
  assert.equal(chat.senders[0], "Ann");
  const d = new Date(m!.ts);
  assert.equal(d.getDate(), 12);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getHours(), 14);
});

test("android 12-hour lowercase meridiem", () => {
  const chat = parseChat("12/03/2024, 2:22 pm - Ann: yo");
  assert.equal(new Date(chat.messages[0]!.ts).getHours(), 14);
});

test("midnight and noon do not collide", () => {
  const chat = parseChat(
    ["12/03/2024, 12:05 am - Ann: midnight", "12/03/2024, 12:05 pm - Ann: noon"].join("\n"),
  );
  assert.equal(new Date(chat.messages[0]!.ts).getHours(), 0);
  assert.equal(new Date(chat.messages[1]!.ts).getHours(), 12);
});

test("ios bracketed with seconds and direction marks", () => {
  const chat = parseChat(`${LRM}[12/03/2024, 14:22:01] Ann: hi`);
  assert.equal(chat.messages[0]?.text, "hi");
  assert.equal(chat.senders[0], "Ann");
  assert.equal(new Date(chat.messages[0]!.ts).getSeconds(), 1);
});

test("ios narrow no-break space before PM", () => {
  const chat = parseChat(`[3/12/24, 2:22:01${NNBSP}PM] Ann: hi`);
  assert.equal(new Date(chat.messages[0]!.ts).getHours(), 14);
});

test("spanish meridiem written as 'p. m.'", () => {
  const chat = parseChat("12/3/2024, 2:22 p. m. - Ana: hola");
  assert.equal(chat.senders[0], "Ana");
  assert.equal(chat.messages[0]?.text, "hola");
  assert.equal(new Date(chat.messages[0]!.ts).getHours(), 14);
});

test("german dotted date", () => {
  const chat = parseChat("12.03.2024, 14:22 - Anna: hallo");
  const d = new Date(chat.messages[0]!.ts);
  assert.equal(d.getDate(), 12);
  assert.equal(d.getMonth(), 2);
});

test("month-first exports are detected", () => {
  // 03/25 can only be month-first, and the whole file must follow suit
  const chat = parseChat(["03/25/2024, 09:00 - Ann: a", "03/26/2024, 09:00 - Ann: b"].join("\n"));
  const d = new Date(chat.messages[0]!.ts);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 25);
});

test("year-first (ISO) dates", () => {
  const chat = parseChat("2024-03-12, 14:22 - Ann: hi");
  const d = new Date(chat.messages[0]!.ts);
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 12);
});

test("two-digit years land this century", () => {
  const chat = parseChat("12/03/24, 14:22 - Ann: hi");
  assert.equal(new Date(chat.messages[0]!.ts).getFullYear(), 2024);
});

test("system lines have no sender", () => {
  const chat = parseChat(
    [
      "12/03/2024, 09:00 - Messages and calls are end-to-end encrypted.",
      "12/03/2024, 09:01 - Ann: hi",
    ].join("\n"),
  );
  assert.equal(chat.messages[0]?.kind, "system");
  assert.equal(chat.messages[0]?.s, -1);
  assert.equal(chat.senders.length, 1);
});

test("a system line quoting a colon does not invent a participant", () => {
  const chat = parseChat(
    [
      '12/03/2024, 09:00 - Ann changed the subject to "Trip: Manali 2024"',
      "12/03/2024, 09:01 - Ann: hi",
      "12/03/2024, 09:02 - Ann: again",
    ].join("\n"),
  );
  assert.deepEqual(chat.senders, ["Ann"]);
  assert.equal(chat.messages[0]?.kind, "system");
});

test("a colon inside the message body stays in the body", () => {
  const chat = parseChat("12/03/2024, 09:00 - Ann: Re: your email");
  assert.equal(chat.senders[0], "Ann");
  assert.equal(chat.messages[0]?.text, "Re: your email");
});

test("phone numbers work as sender names", () => {
  const chat = parseChat("12/03/2024, 09:00 - +91 98765 43210: hi");
  assert.equal(chat.senders[0], "+91 98765 43210");
});

test("multi-line messages keep their line breaks", () => {
  const chat = parseChat(
    [
      "12/03/2024, 09:00 - Ann: line one",
      "line two",
      "line three",
      "12/03/2024, 09:01 - Ann: next",
    ].join("\n"),
  );
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.messages[0]?.text, "line one\nline two\nline three");
});

test("continuation lines that look like a date are not split", () => {
  const chat = parseChat(
    ["12/03/2024, 09:00 - Ann: see you", "on 3/4 at 5 pm", "12/03/2024, 09:01 - Ann: ok"].join(
      "\n",
    ),
  );
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.messages[0]?.text, "see you\non 3/4 at 5 pm");
});

test("android attachment with a caption on the following lines", () => {
  const chat = parseChat(
    ["12/03/2024, 09:00 - Ann: IMG-20240312-WA0001.jpg (file attached)", "look at this 😍"].join(
      "\n",
    ),
    { fileNames: ["IMG-20240312-WA0001.jpg"] },
  );
  const m = chat.messages[0];
  assert.equal(m?.kind, "image");
  assert.equal(m?.file, "IMG-20240312-WA0001.jpg");
  assert.equal(m?.text, "look at this 😍");
  assert.equal(chat.mediaCount, 1);
});

test("android attachment with no caption", () => {
  const chat = parseChat("12/03/2024, 09:00 - Ann: VID-20240312-WA0002.mp4 (file attached)", {
    fileNames: ["VID-20240312-WA0002.mp4"],
  });
  assert.equal(chat.messages[0]?.kind, "video");
  assert.equal(chat.messages[0]?.text, "");
});

test("ios <attached:> keeps its caption", () => {
  const chat = parseChat(
    "[12/03/2024, 14:22:01] Ann: ‎<attached: 00000042-PHOTO-2024-03-12.jpg> beach day",
    { fileNames: ["00000042-PHOTO-2024-03-12.jpg"] },
  );
  assert.equal(chat.messages[0]?.kind, "image");
  assert.equal(chat.messages[0]?.file, "00000042-PHOTO-2024-03-12.jpg");
  assert.equal(chat.messages[0]?.text, "beach day");
});

test("attachments missing from the archive keep a label", () => {
  const chat = parseChat("12/03/2024, 09:00 - Ann: IMG-20240312-WA0001.jpg (file attached)");
  assert.equal(chat.messages[0]?.file, undefined);
  assert.equal(chat.messages[0]?.label, "IMG-20240312-WA0001.jpg");
  assert.equal(chat.messages[0]?.kind, "image");
});

test("attachments are matched by base name inside folders", () => {
  const chat = parseChat("12/03/2024, 09:00 - Ann: IMG-20240312-WA0001.jpg (file attached)", {
    fileNames: ["WhatsApp Chat with Ann/IMG-20240312-WA0001.jpg"],
  });
  assert.equal(chat.messages[0]?.file, "WhatsApp Chat with Ann/IMG-20240312-WA0001.jpg");
});

test("attachments match across case and unicode form", () => {
  // Apple's filesystem hands out decomposed names, so a transcript written
  // composed carries a string that looks the same and compares different.
  const chat = parseChat(
    [
      "12/03/2024, 09:00 - Ann: Café.jpg (file attached)",
      "12/03/2024, 09:01 - Ann: HOLIDAY.JPG (file attached)",
    ].join("\n"),
    // "Cafe" + a combining acute: the decomposed form an iPhone export carries
    { fileNames: ["Cafe\u0301.jpg", "holiday.jpg"] },
  );
  assert.equal(chat.messages[0]?.file, "Cafe\u0301.jpg");
  assert.equal(chat.messages[1]?.file, "holiday.jpg");
});

test("omitted media keeps its kind", () => {
  const chat = parseChat(
    [
      "12/03/2024, 09:00 - Ann: <Media omitted>",
      "12/03/2024, 09:01 - Ann: video omitted",
      "12/03/2024, 09:02 - Ann: audio omitted",
      "12/03/2024, 09:03 - Ann: sticker omitted",
    ].join("\n"),
  );
  assert.deepEqual(
    chat.messages.map((m) => m.kind),
    ["document", "video", "audio", "sticker"],
  );
  assert.equal(chat.mediaCount, 4);
});

test("the edited marker is stripped and flagged", () => {
  const chat = parseChat("12/03/2024, 09:00 - Ann: fixed it <This message was edited>");
  assert.equal(chat.messages[0]?.text, "fixed it");
  assert.equal(chat.messages[0]?.edited, true);
});

test("counts and the busiest-sender heuristic", () => {
  const chat = parseChat(
    [
      "12/03/2024, 09:00 - Ann: 1",
      "12/03/2024, 09:01 - Bob: 1",
      "12/03/2024, 09:02 - Bob: 2",
      "12/03/2024, 09:03 - Bob: 3",
    ].join("\n"),
  );
  assert.deepEqual(chat.senders, ["Ann", "Bob"]);
  assert.deepEqual(chat.counts, [1, 3]);
  assert.equal(chat.meIndex, 1);
});

test("a two-person chat is named after the other participant", () => {
  const chat = parseChat(
    ["12/03/2024, 09:00 - Ann: 1", "12/03/2024, 09:01 - Bob: 1", "12/03/2024, 09:02 - Bob: 2"].join(
      "\n",
    ),
  );
  assert.equal(chat.chatName, "Ann");
});

test("an explicit chat name wins", () => {
  const chat = parseChat("12/03/2024, 09:00 - Ann: hi", { chatName: "Trip Squad" });
  assert.equal(chat.chatName, "Trip Squad");
});

test("empty and junk input do not throw", () => {
  assert.equal(parseChat("").messages.length, 0);
  assert.equal(parseChat("\n\n\n").messages.length, 0);
  assert.equal(parseChat("not a chat at all").messages.length, 0);
});

test("crlf line endings", () => {
  const chat = parseChat("12/03/2024, 09:00 - Ann: a\r\n12/03/2024, 09:01 - Ann: b");
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.messages[0]?.text, "a");
});

test("messages keep their own index", () => {
  const chat = parseChat(
    ["12/03/2024, 09:00 - Ann: a", "12/03/2024, 09:01 - Ann: b", "12/03/2024, 09:02 - Ann: c"].join(
      "\n",
    ),
  );
  assert.deepEqual(
    chat.messages.map((m) => m.i),
    [0, 1, 2],
  );
});

test("progress is reported and ends at the last line", () => {
  const seen: number[] = [];
  const lines = Array.from({ length: 500 }, (_, i) => `12/03/2024, 09:00 - Ann: msg ${i}`);
  parseChat(lines.join("\n"), { onProgress: (p) => seen.push(p) });
  assert.ok(seen.length > 1);
  assert.ok(seen.every((p) => p >= 0 && p <= 1));
});

test("a deleted message is still a message", () => {
  const chat = parseChat("12/03/2024, 09:00 - Ann: This message was deleted");
  assert.equal(chat.messages.length, 1);
  assert.equal(chat.messages[0]?.kind, "text");
});

test("timestamps are non-decreasing for an ordinary export", () => {
  const chat = parseChat(
    ["12/03/2024, 09:00 - Ann: a", "12/03/2024, 23:59 - Ann: b", "13/03/2024, 00:01 - Ann: c"].join(
      "\n",
    ),
  );
  const ts = chat.messages.map((m) => m.ts);
  assert.ok(ts[0]! < ts[1]! && ts[1]! < ts[2]!);
});

test("call events become call messages; sentences about calls do not", () => {
  const chat = parseChat(
    [
      "12/03/2024, 09:00 - Ann: Missed voice call",
      "12/03/2024, 09:01 - Ann: Video call, 12 secs",
      "12/03/2024, 09:02 - Ann: video call me later",
    ].join("\n"),
  );
  assert.deepEqual(
    chat.messages.map((m) => m.kind),
    ["call", "call", "text"],
  );
});

test('the sender named after the archive is never "me"', () => {
  // Real Android export: the owner's messages carry a junk profile name ("-")
  // and the other party out-writes them — counts alone would flip the sides.
  const chat = parseChat(
    [
      "10/08/2025, 12:03 - Pratyusha: Hi Pratham",
      "10/08/2025, 12:03 - Pratyusha: How are things going?",
      "10/08/2025, 12:03 - Pratyusha: Still around?",
      "10/08/2025, 12:04 - -: Hey, all good",
    ].join("\n"),
    { chatName: "Pratyusha" },
  );
  assert.deepEqual(chat.senders, ["Pratyusha", "-"]);
  assert.equal(chat.meIndex, 1);
});

test("without a matching chat name the busiest sender is still me", () => {
  const chat = parseChat(
    ["12/03/2024, 09:00 - Ann: a", "12/03/2024, 09:01 - Ben: b", "12/03/2024, 09:02 - Ben: c"].join(
      "\n",
    ),
    { chatName: "Weekend Trip" },
  );
  assert.equal(chat.meIndex, 1);
});

test("in a group named after a member, that member is still not me", () => {
  const chat = parseChat(
    [
      "12/03/2024, 09:00 - Ann: a",
      "12/03/2024, 09:01 - Ann: b",
      "12/03/2024, 09:02 - Ann: c",
      "12/03/2024, 09:03 - Ben: d",
      "12/03/2024, 09:04 - Cara: e",
      "12/03/2024, 09:05 - Ben: f",
    ].join("\n"),
    { chatName: "Ann" },
  );
  assert.equal(chat.meIndex, 1); // busiest sender that is not Ann
});

test("the export's clock style is detected", () => {
  const h24 = parseChat("10/08/2025, 14:03 - Ann: hey");
  const h12 = parseChat("12/03/24, 2:22 pm - Ann: hey");
  assert.equal(h24.hour12, false);
  assert.equal(h12.hour12, true);
});

test("stray spaces around message lines are trimmed away", () => {
  const chat = parseChat(
    [
      "12/03/2024, 09:00 - Ann:    padded on both sides   ",
      "12/03/2024, 09:01 - Ann: first line   ",
      "   second line\t",
      "",
      "  third after a blank  ",
      "12/03/2024, 09:02 - Ben: IMG-1.jpg (file attached)",
      "   caption with pads   ",
    ].join("\n"),
    { fileNames: ["IMG-1.jpg"] },
  );
  assert.equal(chat.messages[0]?.text, "padded on both sides");
  assert.equal(chat.messages[1]?.text, "first line\nsecond line\n\nthird after a blank");
  assert.equal(chat.messages[2]?.kind, "image");
  assert.equal(chat.messages[2]?.text, "caption with pads");
});
