# WhatsApp Chat Viewer (fully local)

Drop in a WhatsApp export `.zip` and read it back as a real WhatsApp-style conversation — bubbles, dates, media, search — all in the browser. No upload, no backend, nothing leaves the device.

## What gets built

**1. Drop zone (home page `/`)**
- Drag-and-drop or file-picker for a `.zip` (also accepts a plain `_chat.txt`).
- Progress states: unzipping → parsing → indexing, with message count.
- Clear "everything stays on your device" note.

**2. Parser**
- Reads `_chat.txt` / `WhatsApp Chat with X.txt` from the zip.
- Handles both iOS (`[12/03/2024, 14:22:01] Name:`) and Android (`12/03/24, 14:22 - Name:`) formats, 12h/24h, multi-line messages, system messages (joined, encryption notice, deleted), and `<attached: file>` / `file (file attached)` media references.
- Infers the "me" participant (most frequent sender, switchable in settings).

**3. Chat UI (WhatsApp-like)**
- Header with contact name, participant count, search and info actions.
- Message bubbles: outgoing right/tinted, incoming left, sender name colors in groups, timestamp + tick marks, sticky date dividers, reply-quote rendering when present.
- Media: images and video with thumbnails and a lightbox, audio with a player, documents and stickers as attachment chips; unresolved attachments show a placeholder.
- Light and dark WhatsApp-flavored theme with the doodle chat background.

**4. Search & navigation**
- Instant substring search across all messages with match count and prev/next jumping, highlight of matches, and jump-to-message that scrolls the virtual list to the right index.
- Filters: by sender, media-only, and date jump ("scroll to date").

**5. Performance (built for 100k+ messages / hundreds of MB)**
- Zip read and parsing in a **Web Worker** so the UI never blocks; streamed/chunked parse with progress.
- Media extracted **lazily on demand** — a file is only decompressed when its bubble scrolls into view, then served as an object URL from an LRU cache that revokes old URLs.
- **Virtualized message list** (`@tanstack/react-virtual`) with dynamic measurement, so only visible bubbles mount.
- Search index built in the worker; results returned as message indices, not copies.
- Parsed chat kept in compact typed structures; optional IndexedDB cache so reopening the same export is instant.

## Technical notes
- TanStack Start, React 19, Tailwind v4 tokens in `src/styles.css` (WhatsApp green/teal semantic tokens, light + dark).
- `fflate` for zip (streaming, worker-friendly), `@tanstack/react-virtual` for virtualization, `comlink`-free plain `postMessage` worker API.
- Routes: `/` = drop zone + viewer (single-page app shell, viewer replaces drop zone once a file is loaded), with per-route `head()` metadata.
- No database, no server functions, no network calls — pure client. State lives in memory plus optional IndexedDB.
- Structure: `src/lib/whatsapp/parse.ts`, `zip.ts`, `worker.ts`, `useChat.ts`; components `DropZone`, `ChatHeader`, `MessageList` (virtualized), `MessageBubble`, `MediaAttachment`, `SearchBar`, `Lightbox`.

## Not included
Editing/exporting chats, cloud sync, or multi-chat library (one export at a time) — easy to add later.
