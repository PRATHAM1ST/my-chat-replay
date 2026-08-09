# Logo, real chat removal, and remembered scroll position

## 1. A proper Chat Replay logo

Today the app borrows a generic Lucide speech-bubble icon everywhere. Replace it with one custom mark used consistently:

- Generate a distinctive logo (a chat bubble with a "replay/rewind" motif, WhatsApp-green family but not a WhatsApp copy) as a transparent PNG asset.
- Use it in: the empty-state drop zone, the sidebar "Chats" header, the empty chat pane, the install banner, favicon / apple-touch-icon, and the PWA icons (192, 512, maskable).
- Keep the existing layout and sizes; only the mark changes.

## 2. Removing a chat actually clears its local data

Right now removing an entry only drops the file pointer, leaving the chat's saved settings behind — so re-adding the same export resurrects old names and perspective.

- Removing a chat now also deletes: its saved preferences (custom chat name, participant names, who is "you"), its remembered scroll position, and the "last opened chat" marker if it pointed at that entry.
- Replace the instant trash click with a small confirm step (WhatsApp-style dialog) offering **Remove**, so an accidental tap can't wipe settings.
- Wording made honest: it removes the chat from this app only — the .zip on the device is never touched.
- Add a **Clear all chats** item to the sidebar menu (also confirmed) that empties the library plus all stored per-chat data.

## 3. Scroll position remembered per chat (debounced)

- While reading, the transcript's position is saved per chat, debounced (~400ms) so scrolling stays smooth, plus one final save when the chat is closed or the tab is hidden.
- Reopening a chat lands where you left off instead of always jumping to the newest message; if you were already at the bottom, it stays at the bottom (current behaviour).
- Position is stored as the message index (plus a small offset), so it survives media loading changing row heights.
- Removing the chat clears its saved position (see above).

## Technical notes

- `src/lib/whatsapp/prefs.ts`: add `scrollIndex`/`scrollOffset` to `ChatPrefs`, plus `clearPrefs(id)` and `clearAllPrefs()`.
- `src/lib/whatsapp/library.ts`: `removeChat` / `clearChats` also call the prefs cleanup.
- `src/components/whatsapp/MessageList.tsx`: new `initialIndex` prop and `onScrollIndex` callback fired from the existing rAF scroll sampler behind a debounce; initial restore replaces the unconditional `toBottom()` when a stored index exists.
- `src/components/whatsapp/ChatViewer.tsx`: pass stored index in, persist updates via existing `persist()`, flush on `closeChat` and on `visibilitychange`/`pagehide`.
- `src/components/whatsapp/ChatSidebar.tsx`: confirm dialog (shadcn alert-dialog) for remove and clear-all; new `onClearAll` prop.
- Logo asset in `src/assets/`, imported directly; regenerate `public/favicon.png`, `public/apple-touch-icon.png`, `public/icons/*` from the same mark.
