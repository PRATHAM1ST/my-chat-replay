import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WaClient } from "@/lib/whatsapp/client";
import type { Msg, ParsedChat, SearchScope } from "@/lib/whatsapp/types";
import {
  clearChats,
  entryId,
  entryNeedsPermission,
  fileFromEntry,
  getLastId,
  listChats,
  pickArchives,
  putChat,
  removeChat,
  setLastId,
  type LibraryEntry,
} from "@/lib/whatsapp/library";
import {
  QuotaError,
  hasArchive,
  requestPersistence,
  saveArchive,
  vaultSupported,
} from "@/lib/whatsapp/vault";
import { displayNames, getPrefs, savePrefs, type ChatPrefs } from "@/lib/whatsapp/prefs";
import { onLaunchWithFile } from "@/lib/whatsapp/launch";
import { hasPendingShare, registerPwaWorker, takeSharedFile } from "@/lib/whatsapp/share";
import { getReactions, saveReactions, withReaction } from "@/lib/whatsapp/reactions";
import { getReplies, saveReplies, withLink, withoutLink } from "@/lib/whatsapp/replies";
import { getStars, withToggled, saveStars } from "@/lib/whatsapp/stars";

import { ChatHeader } from "./ChatHeader";
import { ChatSidebar } from "./ChatSidebar";
import { ContactInfo } from "./ContactInfo";
import { DropZone } from "./DropZone";
import { Lightbox } from "./Lightbox";
import { Logo } from "./Logo";
import { MessageList } from "./MessageList";

import { NavRail } from "./NavRail";
import { PwaInstallBanner } from "./PwaInstallBanner";
import { SearchPanel } from "./SearchPanel";
import { Toast } from "./ui";

const EMPTY = new Int32Array(0);

export function ChatViewer() {
  const clientRef = useRef<WaClient | null>(null);
  const [chat, setChat] = useState<ParsedChat | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** the chat a failed open can be retried on */
  const [retry, setRetry] = useState<LibraryEntry | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [stars, setStars] = useState<Set<number>>(new Set());
  const [reactions, setReactions] = useState<Map<number, string>>(new Map());
  const [replies, setReplies] = useState<Map<number, number>>(new Map());
  /** index of the reply whose quoted message is being picked, or null */
  const [linking, setLinking] = useState<number | null>(null);
  /** the manifest shortcut lands here with ?action=open */
  const [pickerView, setPickerView] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const closeChatRef = useRef<(() => void) | null>(null);
  /** bumped on every open; a load whose token is stale must not touch state */
  const loadSeq = useRef(0);
  const sharePending = useRef(hasPendingShare());
  /** the app-shortcut launch asked for the picker — nothing should auto-open */
  const wantsPicker = useRef(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("action") === "open",
  );

  const [meIndex, setMeIndex] = useState(0);
  const [dark, setDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sender, setSender] = useState<number | null>(null);
  const [scope, setScope] = useState<SearchScope>("all");
  const [searching, setSearching] = useState(false);

  const [matches, setMatches] = useState<Int32Array>(EMPTY);
  const [matchPos, setMatchPos] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ index: number; nonce: number } | null>(null);
  const nonce = useRef(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<ChatPrefs>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const fallbackInput = useRef<HTMLInputElement>(null);

  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [needsPermission, setNeedsPermission] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  // theme
  useEffect(() => {
    const stored = localStorage.getItem("wa-theme");
    const prefers =
      stored === "dark" ||
      (stored === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefers);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("wa-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => () => clientRef.current?.destroy(), []);

  const refreshLibrary = useCallback(async () => {
    const all = await listChats();
    const locked = new Set<string>();
    for (const e of all) if (await entryNeedsPermission(e)) locked.add(e.id);
    setEntries(all);
    setNeedsPermission(locked);
    return all;
  }, []);

  const resetSearch = useCallback(() => {
    setQuery("");
    setDebounced("");
    setSender(null);
    setScope("all");
    setMatches(EMPTY);
    setMatchPos(0);
    setActiveIndex(null);
  }, []);

  const handleFile = useCallback(
    async (file: File, handle?: FileSystemFileHandle) => {
      const seq = ++loadSeq.current;
      setError(null);
      setRetry(null);
      setBusy(true);
      setPhase("Reading file");
      setPct(0.02);
      clientRef.current?.destroy();
      const client = new WaClient();
      clientRef.current = client;
      try {
        const parsed = await client.load(file, {
          onProgress: (p, v) => {
            if (loadSeq.current !== seq) return;
            setPhase(p);
            setPct(v);
          },
        });
        // Another archive started opening while this one was parsing — a
        // shared file arriving on top of the restored chat, say. Newest wins.
        if (loadSeq.current !== seq) {
          client.destroy();
          return;
        }
        if (!parsed.messages.length) {
          throw new Error("No messages could be read from this export.");
        }
        const id = entryId(file.name, file.size);
        const stored = getPrefs(id);
        resetSearch();
        setSearchOpen(false);
        setInfoOpen(false);
        setPrefs(stored);
        setChat(parsed);
        setMobileChatOpen(true);
        setMeIndex(
          stored.meIndex !== undefined && stored.meIndex < parsed.senders.length
            ? stored.meIndex
            : parsed.meIndex,
        );
        setBusy(false);

        const now = Date.now();
        const entry: LibraryEntry = {
          id,
          name: file.name,
          size: file.size,
          addedAt: now,
          lastOpened: now,
          chatName: stored.chatName ?? parsed.chatName,
          msgCount: parsed.messages.length,
          mediaCount: parsed.mediaCount,
          ...(handle ? { handle } : {}),
        };
        await putChat(entry);
        setLastId(id);
        setActiveId(id);
        setStars(getStars(id));
        setReactions(getReactions(id));
        setReplies(getReplies(id));
        setLinking(null);
        setPickerView(false);
        void refreshLibrary();

        // Keep our own copy so this chat reopens without a permission prompt —
        // in the background, because the transcript is already on screen.
        void (async () => {
          if (!vaultSupported || (await hasArchive(id))) {
            if (await hasArchive(id)) await putChat({ ...entry, stored: true });
            void refreshLibrary();
            return;
          }
          try {
            await requestPersistence();
            await saveArchive(id, file);
            await putChat({ ...entry, stored: true });
          } catch (e) {
            // Out of room, or a browser that will not keep one. The handle
            // still works, so this only costs the odd permission prompt.
            if (e instanceof QuotaError) setNotice(e.message);
          }
          void refreshLibrary();
        })();
      } catch (e) {
        client.destroy();
        if (loadSeq.current !== seq) return;
        clientRef.current = null;
        setBusy(false);
        if ((e as Error)?.name !== "AbortError") {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
      if (loadSeq.current === seq) setBusyId(null);
    },
    [refreshLibrary, resetSearch],
  );

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.canShare === "function");
  }, []);

  const toggleStar = useCallback(
    (index: number) => {
      setStars((prev) => {
        const next = withToggled(prev, index);
        saveStars(activeId, next);
        return next;
      });
    },
    [activeId],
  );

  const react = useCallback(
    (index: number, emoji: string | null) => {
      setReactions((prev) => {
        const next = withReaction(prev, index, emoji);
        saveReactions(activeId, next);
        return next;
      });
    },
    [activeId],
  );

  const pickQuoted = useCallback(
    (quotedIndex: number) => {
      setLinking((from) => {
        if (from !== null && from !== quotedIndex) {
          setReplies((prev) => {
            const next = withLink(prev, from, quotedIndex);
            saveReplies(activeId, next);
            return next;
          });
        }
        return null;
      });
    },
    [activeId],
  );

  const removeReplyLink = useCallback(
    (index: number) => {
      setReplies((prev) => {
        const next = withoutLink(prev, index);
        saveReplies(activeId, next);
        return next;
      });
    },
    [activeId],
  );

  // Esc backs out of quote-picking, like every other mode in the app.
  useEffect(() => {
    if (linking === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLinking(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linking]);

  /**
   * Open a batch of archives: the first one on screen, the rest imported into
   * the chat list in the background so they are one tap away.
   */
  const importQuietly = useCallback(async (file: File) => {
    const client = new WaClient();
    try {
      const parsed = await client.load(file, { onProgress: () => undefined });
      if (!parsed.messages.length) return false;
      const id = entryId(file.name, file.size);
      const stored = getPrefs(id);
      const now = Date.now();
      const entry: LibraryEntry = {
        id,
        name: file.name,
        size: file.size,
        addedAt: now,
        lastOpened: now,
        chatName: stored.chatName ?? parsed.chatName,
        msgCount: parsed.messages.length,
        mediaCount: parsed.mediaCount,
      };
      await putChat(entry);
      if (vaultSupported) {
        try {
          await saveArchive(id, file);
          await putChat({ ...entry, stored: true });
        } catch {
          /* no room for a copy — the entry still lists, reopen will ask */
        }
      }
      return true;
    } catch {
      return false;
    } finally {
      client.destroy();
    }
  }, []);

  const handleFiles = useCallback(
    async (files: File[], firstHandle?: FileSystemFileHandle) => {
      const [first, ...rest] = files;
      if (!first) return;
      await handleFile(first, firstHandle);
      if (!rest.length) return;
      let added = 0;
      for (const file of rest) if (await importQuietly(file)) added++;
      void refreshLibrary();
      if (added) setNotice(`Added ${added} more chat${added > 1 ? "s" : ""} to your list.`);
      else setError("The other files could not be read as WhatsApp exports.");
    },
    [handleFile, importQuietly, refreshLibrary],
  );

  const openEntry = useCallback(
    async (entry: LibraryEntry) => {
      setError(null);
      setRetry(null);
      setBusyId(entry.id);
      const file = await fileFromEntry(entry, { request: true });
      if (!file) {
        setBusyId(null);
        setRetry(entry);
        setError(
          entry.handle
            ? "Access to that file was not granted — allow it, or open the archive again."
            : "The copy of this chat is gone. Open the archive again to bring it back.",
        );
        void refreshLibrary();
        return;
      }
      await handleFile(file, entry.handle);
    },
    [handleFile, refreshLibrary],
  );

  const removeEntries = useCallback(
    async (list: LibraryEntry[]) => {
      for (const entry of list) {
        await removeChat(entry.id);
        if (entry.id === activeId) closeChatRef.current?.();
      }
      void refreshLibrary();
    },
    [refreshLibrary, activeId],
  );

  /**
   * Hand the archives themselves to the OS share sheet — the same files the
   * user gave us, so a chat can be passed on to another app or device.
   */
  const shareEntries = useCallback(async (list: LibraryEntry[]) => {
    const files: File[] = [];
    for (const entry of list.slice(0, 8)) {
      const file = await fileFromEntry(entry, { request: true });
      if (file) files.push(file);
    }
    if (!files.length) {
      setError("Those chats have no copy on this device to share.");
      return;
    }
    if (!navigator.canShare?.({ files })) {
      setError("This browser can't share files. Open the chat and use Download instead.");
      return;
    }
    try {
      await navigator.share({
        files,
        title: files.length === 1 ? (list[0]?.chatName ?? "Chat export") : "Chat exports",
      });
    } catch (e) {
      // the user backing out of the share sheet is not a failure
      if ((e as Error)?.name !== "AbortError") setError("Sharing was interrupted.");
    }
  }, []);

  const addArchive = useCallback(async () => {
    const picked = await pickArchives();
    if (picked?.length) {
      await handleFiles(
        picked.map((p) => p.file),
        picked[0]?.handle,
      );
    } else fallbackInput.current?.click();
  }, [handleFiles]);

  // Reopen the last chat on load — but only when doing so is silent. Anything
  // that would raise a permission prompt waits for the user to tap the chat.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      const all = await refreshLibrary();
      // A share (or an OS "open with") is already bringing its own archive,
      // and the "Open an export" shortcut wants an empty picker, not a chat.
      if (sharePending.current || wantsPicker.current || loadSeq.current > 0) return;
      const last = all.find((e) => e.id === getLastId());
      if (!last || (await entryNeedsPermission(last))) return;
      const file = await fileFromEntry(last);
      if (file) {
        setBusyId(last.id);
        void handleFile(file, last.handle);
      }
    })();
  }, [refreshLibrary, handleFile]);

  // Installed app: the OS may launch us with an archive ("Open with Chat Replay").
  useEffect(() => {
    onLaunchWithFile((file, handle) => void handleFile(file, handle));
  }, [handleFile]);

  // Installed app: an archive shared to us via the Android share sheet.
  useEffect(() => {
    registerPwaWorker();
    void takeSharedFile().then((file) => {
      if (file) void handleFile(file);
    });
  }, [handleFile]);

  // The "Open an export" app shortcut lands on /?action=open.
  useEffect(() => {
    if (!wantsPicker.current) return;
    setPickerView(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Drop a .zip anywhere in the app — not just on the welcome screen.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDropHover(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDropHover(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDropHover(false);
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
        /\.(zip|txt)$/i.test(f.name),
      );
      if (files.length) void handleFiles(files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [handleFiles]);

  // debounce search input
  useEffect(() => {
    if (query === debounced) return;
    setSearching(true);
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query, debounced]);

  // run the search in the worker; the transcript itself is never filtered
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !chat) return;
    let alive = true;
    setSearching(true);
    client.query(debounced, sender, scope).then((r) => {
      if (!alive) return;
      setSearching(false);
      setMatches(r.matches);
      if (r.matches.length) {
        setMatchPos(0);
        const idx = r.matches[0] ?? 0;
        setActiveIndex(idx);
        nonce.current++;
        setScrollTarget({ index: idx, nonce: nonce.current });
      } else {
        setMatchPos(0);
        setActiveIndex(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [chat, debounced, sender, scope]);

  const matchSet = useMemo(() => new Set(Array.from(matches)), [matches]);

  const senderNames = useMemo(() => (chat ? displayNames(chat.senders, prefs) : []), [chat, prefs]);
  const chatName = prefs.chatName ?? chat?.chatName ?? "Chat";

  /** every image/video/sticker in order — the carousel's playlist */
  const mediaMsgs = useMemo(
    () =>
      chat
        ? chat.messages.filter(
            (m) => m.file && (m.kind === "image" || m.kind === "video" || m.kind === "sticker"),
          )
        : [],
    [chat],
  );

  const openMedia = useCallback(
    (msg: Msg) => {
      const at = mediaMsgs.findIndex((m) => m.i === msg.i);
      setLightboxIdx(at === -1 ? null : at);
    },
    [mediaMsgs],
  );

  // Prefs are also written outside React (scroll position, every ~400ms while
  // reading), so keep a mirror the writer can merge into without re-rendering.
  const prefsRef = useRef<ChatPrefs>({});
  prefsRef.current = prefs;

  const persist = useCallback(
    (patch: ChatPrefs) => {
      setPrefs((prev) => savePrefs(activeId, { ...prev, ...patch }));
    },
    [activeId],
  );

  const savePosition = useCallback(
    (pos: { index: number; offset: number; atBottom: boolean }) => {
      if (!activeId) return;
      const next = {
        ...prefsRef.current,
        scrollIndex: pos.index,
        scrollOffset: pos.offset,
        atBottom: pos.atBottom,
      };
      prefsRef.current = next;
      savePrefs(activeId, next);
    },
    [activeId],
  );

  const restore = useMemo(
    () => ({
      index: prefs.scrollIndex ?? 0,
      offset: prefs.scrollOffset ?? 0,
      atBottom: prefs.atBottom ?? prefs.scrollIndex === undefined,
    }),
    [prefs.scrollIndex, prefs.scrollOffset, prefs.atBottom],
  );

  const changeMe = useCallback(
    (i: number) => {
      setMeIndex(i);
      persist({ meIndex: i });
    },
    [persist],
  );

  const swapSides = useCallback(() => {
    if (!chat || chat.senders.length < 2) return;
    const next =
      chat.senders.length === 2 ? (meIndex === 0 ? 1 : 0) : (meIndex + 1) % chat.senders.length;
    changeMe(next);
  }, [chat, meIndex, changeMe]);

  const renameSender = useCallback(
    (index: number, name: string) => {
      const original = chat?.senders[index];
      if (!original) return;
      setPrefs((prev) =>
        savePrefs(activeId, { ...prev, names: { ...prev.names, [original]: name } }),
      );
    },
    [chat, activeId],
  );

  const renameChat = useCallback(
    (name: string) => {
      persist({ chatName: name });
      const entry = entries.find((e) => e.id === activeId);
      if (entry) {
        void putChat({ ...entry, chatName: name }).then(() => void refreshLibrary());
      }
    },
    [persist, entries, activeId, refreshLibrary],
  );

  const jumpTo = useCallback((globalIndex: number) => {
    setActiveIndex(globalIndex);
    nonce.current++;
    setScrollTarget({ index: globalIndex, nonce: nonce.current });
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (!matches.length) return;
      const pos = (matchPos + delta + matches.length) % matches.length;
      setMatchPos(pos);
      jumpTo(matches[pos] ?? 0);
    },
    [matchPos, matches, jumpTo],
  );

  const jumpDate = useCallback(
    (value: string) => {
      if (!chat || !value) return;
      const target = new Date(`${value}T00:00:00`).getTime();
      const msgs = chat.messages;
      let lo = 0;
      let hi = msgs.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((msgs[mid]?.ts ?? 0) < target) lo = mid + 1;
        else hi = mid;
      }
      jumpTo(msgs[Math.min(lo, msgs.length - 1)]?.i ?? 0);
    },
    [chat, jumpTo],
  );

  const closeChat = useCallback(() => {
    clientRef.current?.destroy();
    clientRef.current = null;
    setChat(null);
    resetSearch();
    setSearchOpen(false);
    setLightboxIdx(null);
    setPrefs({});
    setInfoOpen(false);
    setMobileChatOpen(false);
    setActiveId(null);
    setStars(new Set());
    setReactions(new Map());
    setReplies(new Map());
    setLinking(null);
    void refreshLibrary();
  }, [refreshLibrary, resetSearch]);

  closeChatRef.current = closeChat;

  /** Forget every chat we know about — the archives themselves stay untouched. */
  const clearAll = useCallback(async () => {
    await clearChats();
    closeChat();
  }, [closeChat]);

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) resetSearch();
      else setInfoOpen(false);
      return !open;
    });
  }, [resetSearch]);

  const openInfo = useCallback(() => {
    setSearchOpen(false);
    setInfoOpen(true);
  }, []);

  // ⌘/Ctrl+F opens the in-chat search, like the desktop app
  useEffect(() => {
    if (!chat) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setInfoOpen(false);
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat]);

  if ((!entries.length && !chat) || pickerView) {
    return (
      <>
        <DropZone
          onFiles={(files, handle) => void handleFiles(files, handle)}
          busy={busy}
          phase={phase}
          pct={pct}
          error={error}
        />
        {pickerView && (entries.length > 0 || chat) && (
          <button
            type="button"
            onClick={() => {
              wantsPicker.current = false;
              setPickerView(false);
            }}
            className="fixed left-4 top-4 z-[60] cursor-pointer rounded-full bg-wa-elevated px-4 py-2 text-[13.5px] font-medium text-wa-panel-foreground shadow-[var(--wa-shadow-panel)] transition-colors hover:bg-wa-hover"
          >
            ← Back to chats
          </button>
        )}
        <PwaInstallBanner />
      </>
    );
  }

  const client = clientRef.current;
  const hasChat = !!chat && !!client;

  return (
    <main className="relative flex h-[100dvh] overflow-hidden bg-wa-app">
      <input
        ref={fallbackInput}
        type="file"
        accept=".zip,.txt"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void handleFiles(files);
          event.target.value = "";
        }}
      />

      <NavRail
        hasChat={hasChat}
        searchOpen={searchOpen}
        infoOpen={infoOpen}
        dark={dark}
        onSearch={toggleSearch}
        onInfo={() => (infoOpen ? setInfoOpen(false) : openInfo())}
        onAdd={() => void addArchive()}
        onToggleDark={() => setDark((v) => !v)}
      />

      <div
        className={`${mobileChatOpen ? "hidden" : "flex"} h-full w-full shrink-0 md:flex md:w-auto`}
      >
        <ChatSidebar
          entries={entries}
          activeId={activeId}
          needsPermission={needsPermission}
          busyId={busyId}
          onAdd={() => void addArchive()}
          onOpen={(entry) => void openEntry(entry)}
          onRemove={(list) => void removeEntries(list)}
          onShare={(list) => void shareEntries(list)}
          onClearAll={() => void clearAll()}
          canShare={canShare}

          dark={dark}
          onToggleDark={() => setDark((value) => !value)}
        />
      </div>

      <section
        className={`${mobileChatOpen ? "flex" : "hidden"} relative min-w-0 flex-1 flex-col bg-wa-chat md:flex`}
      >
        {chat && client ? (
          <>
            <ChatHeader
              chatName={chatName}
              senders={senderNames}
              meIndex={meIndex}
              onMeChange={changeMe}
              onSwap={swapSides}
              searchOpen={searchOpen}
              onToggleSearch={toggleSearch}
              onBack={() => setMobileChatOpen(false)}
              onOpenInfo={openInfo}
              onCloseChat={closeChat}
            />

            <MessageList
              key={activeId ?? "chat"}
              messages={chat.messages}
              senders={senderNames}
              meIndex={meIndex}
              client={client}
              query={debounced}
              matchSet={matchSet}
              starredSet={stars}
              onToggleStar={toggleStar}
              reactions={reactions}
              onReact={react}
              replies={replies}
              linking={linking !== null}
              onPickQuoted={pickQuoted}
              onQuoteJump={jumpTo}
              onStartReplyLink={(i) => setLinking(i)}
              onRemoveReplyLink={removeReplyLink}
              activeIndex={activeIndex}
              scrollTarget={scrollTarget}
              onOpenMedia={(msg) => openMedia(msg)}
              restore={restore}
              onPosition={savePosition}
            />
          </>
        ) : (
          <div className="wa-doodle flex flex-1 items-center justify-center px-6 text-center">
            <div className="relative z-10 max-w-sm">
              <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-wa-surface shadow-[var(--wa-shadow-panel)]">
                <Logo size={40} />
              </span>

              <h2 className="mt-5 text-[26px] font-light text-wa-panel-foreground">Chat Replay</h2>
              <p className="mt-2 text-[14px] text-wa-meta">
                Pick a chat on the left, or open another export. Everything stays on this device.
              </p>
            </div>
          </div>
        )}
      </section>

      {searchOpen && chat && client && (
        <SearchPanel
          messages={chat.messages}
          senders={senderNames}
          meIndex={meIndex}
          query={query}
          onQuery={setQuery}
          scope={scope}
          onScope={setScope}
          sender={sender}
          onSender={setSender}
          matches={matches}
          matchPos={matchPos}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onPick={(globalIndex, pos) => {
            setMatchPos(pos);
            jumpTo(globalIndex);
          }}
          onJumpDate={jumpDate}
          onClose={toggleSearch}
          busy={searching}
        />
      )}

      {infoOpen && chat && client && (
        <ContactInfo
          chat={chat}
          client={client}
          chatName={chatName}
          senders={senderNames}
          meIndex={meIndex}
          onMeChange={changeMe}
          onSwap={swapSides}
          onRenameChat={renameChat}
          onRenameSender={renameSender}
          onClose={() => setInfoOpen(false)}
          onOpenMedia={openMedia}
          starred={stars}
          onJumpTo={(index) => {
            jumpTo(index);
            setInfoOpen(false);
            setMobileChatOpen(true);
          }}
        />
      )}

      <Lightbox
        items={mediaMsgs}
        index={lightboxIdx}
        client={client}
        senders={senderNames}
        meIndex={meIndex}
        onIndex={setLightboxIdx}
        onClose={() => setLightboxIdx(null)}
      />

      {linking !== null && (
        <div className="wa-fade-in pointer-events-none fixed inset-x-0 top-3 z-[75] flex justify-center px-3">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-wa-elevated px-3.5 py-2.5 text-[13.5px] text-wa-panel-foreground shadow-[var(--wa-shadow-float)] ring-1 ring-black/5 dark:ring-white/10">
            <span>Tap the message this one replies to</span>
            <button
              type="button"
              onClick={() => setLinking(null)}
              className="shrink-0 cursor-pointer rounded-full bg-wa-input px-3 py-1 text-[13px] font-medium hover:bg-wa-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {dropHover && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-wa-app/80 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-wa-green bg-wa-surface px-10 py-8 text-center shadow-[var(--wa-shadow-float)]">
            <Logo size={44} />
            <p className="text-[16px] font-medium text-wa-panel-foreground">Drop to open</p>
            <p className="text-[13px] text-wa-meta">
              WhatsApp .zip or _chat.txt — several at once works too
            </p>
          </div>
        </div>
      )}

      {error && (
        <Toast
          message={error}
          {...(retry ? { actionLabel: "Try again", onAction: () => void openEntry(retry) } : {})}
          onDismiss={() => {
            setError(null);
            setRetry(null);
          }}
        />
      )}
      {!error && notice && <Toast message={notice} tone="info" onDismiss={() => setNotice(null)} />}

      <PwaInstallBanner />
    </main>
  );
}
