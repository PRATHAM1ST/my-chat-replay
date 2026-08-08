import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WaClient } from "@/lib/whatsapp/client";
import { lowerBound } from "@/lib/whatsapp/format";
import type { Msg, ParsedChat } from "@/lib/whatsapp/types";
import {
  entryId,
  fileFromEntry,
  getLastId,
  handlePermission,
  listChats,
  pickArchive,
  putChat,
  removeChat,
  setLastId,
  type LibraryEntry,
} from "@/lib/whatsapp/library";
import { displayNames, getPrefs, savePrefs, type ChatPrefs } from "@/lib/whatsapp/prefs";
import { ChatHeader } from "./ChatHeader";
import { ChatSidebar } from "./ChatSidebar";
import { ContactInfo } from "./ContactInfo";
import { DropZone } from "./DropZone";
import { Lightbox } from "./Lightbox";
import { MessageList } from "./MessageList";
import { SearchBar } from "./SearchBar";

const EMPTY = new Int32Array(0);

export function ChatViewer() {
  const clientRef = useRef<WaClient | null>(null);
  const [chat, setChat] = useState<ParsedChat | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [meIndex, setMeIndex] = useState(0);
  const [dark, setDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sender, setSender] = useState<number | null>(null);
  const [mediaOnly, setMediaOnly] = useState(false);

  const [view, setView] = useState<Int32Array>(EMPTY);
  const [matches, setMatches] = useState<Int32Array>(EMPTY);
  const [matchPos, setMatchPos] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ row: number; nonce: number } | null>(null);
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
    for (const e of all) {
      if (!e.handle || (await handlePermission(e.handle)) !== "granted") locked.add(e.id);
    }
    setEntries(all);
    setNeedsPermission(locked);
    return all;
  }, []);

  const handleFile = useCallback(
    async (file: File, handle?: FileSystemFileHandle) => {
      setError(null);
      setBusy(true);
      setPhase("Reading file");
      setPct(0.02);
      clientRef.current?.destroy();
      const client = new WaClient();
      clientRef.current = client;
      try {
        const parsed = await client.load(file, {
          onProgress: (p, v) => {
            setPhase(p);
            setPct(v);
          },
        });
        if (!parsed.messages.length) {
          throw new Error("No messages could be read from this export.");
        }
        const id = entryId(file.name, file.size);
        const stored = getPrefs(id);
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
        await putChat({
          id,
          name: file.name,
          size: file.size,
          addedAt: now,
          lastOpened: now,
          chatName: stored.chatName ?? parsed.chatName,
          msgCount: parsed.messages.length,
          mediaCount: parsed.mediaCount,
          ...(handle ? { handle } : {}),
        });
        setLastId(id);
        setActiveId(id);
        void refreshLibrary();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
        client.destroy();
        clientRef.current = null;
      }
      setBusyId(null);
    },
    [refreshLibrary],
  );

  const openEntry = useCallback(
    async (entry: LibraryEntry) => {
      setError(null);
      setBusyId(entry.id);
      const file = await fileFromEntry(entry, { request: true });
      if (!file) {
        setBusyId(null);
        setError(
          entry.handle
            ? "Access to that file was not granted. Pick it again to continue."
            : "This browser can't reopen files by itself — drop the archive again.",
        );
        void refreshLibrary();
        return;
      }
      await handleFile(file, entry.handle);
    },
    [handleFile, refreshLibrary],
  );

  const removeEntry = useCallback(
    async (entry: LibraryEntry) => {
      await removeChat(entry.id);
      void refreshLibrary();
    },
    [refreshLibrary],
  );

  const addArchive = useCallback(async () => {
    const picked = await pickArchive();
    if (picked) await handleFile(picked.file, picked.handle);
    else fallbackInput.current?.click();
  }, [handleFile]);

  // Load the library and silently reopen the last chat when access is still granted.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      const all = await refreshLibrary();
      const lastId = getLastId();
      const last = all.find((e) => e.id === lastId);
      if (!last?.handle) return;
      if ((await handlePermission(last.handle)) !== "granted") return;
      const file = await fileFromEntry(last);
      if (file) {
        setBusyId(last.id);
        void handleFile(file, last.handle);
      }
    })();
  }, [refreshLibrary, handleFile]);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  // run the filter/search in the worker
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !chat) return;
    let alive = true;
    client.query(debounced, sender, mediaOnly).then((r) => {
      if (!alive) return;
      setView(r.view);
      setMatches(r.matches);
      if (r.matches.length) {
        const pos = r.matches.length - 1;
        setMatchPos(pos);
        const idx = r.matches[pos] ?? 0;
        setActiveIndex(idx);
        nonce.current++;
        setScrollTarget({ row: lowerBound(r.view, idx), nonce: nonce.current });
      } else {
        setMatchPos(0);
        setActiveIndex(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [chat, debounced, sender, mediaOnly]);

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

  const persist = useCallback(
    (patch: ChatPrefs) => {
      setPrefs((prev) => savePrefs(activeId, { ...prev, ...patch }));
    },
    [activeId],
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

  const jumpTo = useCallback(
    (globalIndex: number) => {
      setActiveIndex(globalIndex);
      nonce.current++;
      setScrollTarget({ row: lowerBound(view, globalIndex), nonce: nonce.current });
    },
    [view],
  );

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

  const closeChat = () => {
    clientRef.current?.destroy();
    clientRef.current = null;
    setChat(null);
    setView(EMPTY);
    setMatches(EMPTY);
    setQuery("");
    setDebounced("");
    setSender(null);
    setMediaOnly(false);
    setSearchOpen(false);
    setLightboxIdx(null);
    setPrefs({});
    setInfoOpen(false);
    setMobileChatOpen(false);
    setActiveId(null);
    void refreshLibrary();
  };

  if (!entries.length && !chat) {
    return <DropZone onFile={handleFile} busy={busy} phase={phase} pct={pct} error={error} />;
  }

  const client = clientRef.current;

  return (
    <main className="relative flex h-[100dvh] overflow-hidden bg-wa-chat">
      <input
        ref={fallbackInput}
        type="file"
        accept=".zip,.txt"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
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
          onRemove={(entry) => void removeEntry(entry)}
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
              onToggleSearch={() => setSearchOpen((v) => !v)}
              onBack={closeChat}
              onOpenInfo={() => setInfoOpen(true)}
            />

            {searchOpen && (
              <SearchBar
                query={query}
                onQuery={setQuery}
                matchCount={matches.length}
                matchPos={matchPos}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                senders={senderNames}
                sender={sender}
                onSender={setSender}
                mediaOnly={mediaOnly}
                onMediaOnly={setMediaOnly}
                onJumpDate={jumpDate}
              />
            )}

            <MessageList
              messages={chat.messages}
              view={view}
              senders={senderNames}
              meIndex={meIndex}
              client={client}
              query={debounced}
              matchSet={matchSet}
              activeIndex={activeIndex}
              scrollTarget={scrollTarget}
              onOpenMedia={(msg) => openMedia(msg)}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <h2 className="text-3xl font-light text-wa-panel-foreground">Chat Replay</h2>
              <p className="mt-3 text-sm text-wa-meta">Select a chat from your local library</p>
            </div>
          </div>
        )}
      </section>

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
        />
      )}

      <Lightbox
        items={mediaMsgs}
        index={lightboxIdx}
        client={client}
        senders={senderNames}
        onIndex={setLightboxIdx}
        onClose={() => setLightboxIdx(null)}
      />
    </main>
  );
}
