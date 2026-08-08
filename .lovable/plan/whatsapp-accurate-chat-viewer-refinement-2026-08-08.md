# WhatsApp-accurate chat viewer refinement

## Goal
Turn the current replay screen into a cleaner WhatsApp-style application: saved chats remain accessible, the active conversation uses authentic message/media composition, and clicking the contact opens useful chat details.

## Interface shell
- Replace the separate upload-first/viewer-first screens with a responsive WhatsApp-style shell.
- On desktop, keep a left chat sidebar visible with saved exports, compact search, add-archive action, active-chat highlighting, and per-chat removal through a menu.
- On mobile, use WhatsApp-style single-pane navigation: chat list first, conversation after selection, and a back button to return to the list.
- When one or more archives already exist, remove the explanatory paragraphs and large drop zone. Show a compact chat list and a small add-chat action instead.
- Keep a minimal first-run upload state only when no chats exist: one clear archive picker/drop target, short privacy text, and parsing progress.
- Remove the persistent message-count footer and move secondary controls such as theme and “you are” selection into an overflow/settings menu.

## Conversation and message fidelity
- Recompose message bubbles so image, video, sticker, document, and audio content lives inside the same bubble container as its caption and timestamp.
- Let image/video media run edge-to-edge within the bubble while captions and metadata receive inner padding, matching WhatsApp’s media-card geometry.
- Preserve bubble tails, sender grouping, dates, links, edited labels, read receipts, missing-media states, and virtualization.
- Correct emoji-only rendering: 1–3 emoji display large without a colored bubble; 4–6 use the smaller large-emoji treatment; mixed emoji/text stays inside a normal bubble. Timestamp/read receipt placement will remain readable without forcing the emoji back into a bubble.
- Adjust virtual-row size estimates for the new media and emoji layouts to avoid scroll jumps.

## Contact information drawer
- Make the contact avatar/name area in the chat header interactive.
- Open a WhatsApp-style contact/group info panel on desktop and a full-screen details view on mobile.
- Include participant/chat identity, message/media totals, and categorized Media, Links, and Docs sections derived from the parsed archive.
- Show compact media previews and allow opening media in the existing viewer; links open safely in a new tab and documents download locally.
- Keep this derived from the currently loaded local archive with no upload or new persistence.

## Emoji rendering
- Remove the remote `@font-face` URL from the CSS and stop presenting Noto Color Emoji as WhatsApp’s own emoji font.
- Use raw Unicode plus a consistent locally installed open-source emoji renderer (Twemoji-compatible assets) for the full current Unicode emoji set, including sequences, skin tones, flags, and joined emoji.
- Apply the renderer only to emoji glyphs so surrounding text, timestamps, numbers, and links retain the WhatsApp system-font stack.
- Use the same renderer in normal messages, emoji-only messages, names, captions, and relevant UI text.

## Visual alignment
- Refine the header, sidebar rows, search treatment, icons, spacing, typography, colors, wallpaper opacity, bubble widths, and responsive breakpoints against current WhatsApp Web conventions.
- Use a 59–60px chat header, 24px outlined controls, WhatsApp light/dark surface roles, and a desktop multi-pane layout without decorative cards.
- Keep all controls accessible with labels, keyboard focus, and adequate contrast.

## Technical details
- Extend the current frontend state rather than adding a backend; archives and file handles remain local in IndexedDB.
- Keep `@tanstack/react-virtual` for the message transcript and memoize derived Media/Links/Docs collections so large archives remain responsive.
- Add small focused components for the sidebar, contact info panel, media gallery, and emoji rendering rather than expanding the existing viewer component further.
- Use the existing semantic WhatsApp tokens and add only the missing surface/state tokens in the global stylesheet.

## Verification
- Test first-run upload, one saved chat, multiple saved chats, reopening/removing chats, and permission recovery.
- Test text, emoji-only, mixed emoji/text, images with and without captions, video, audio, stickers, documents, missing attachments, links, and group sender names.
- Validate long-list scrolling and jump-to-search after dynamic media measurement.
- Check desktop and the current 424×775 mobile viewport for clipping, overlap, pane navigation, details-panel behavior, and media containment.
- Run the full lint and production build, then verify the finished interface in the browser with representative exports.