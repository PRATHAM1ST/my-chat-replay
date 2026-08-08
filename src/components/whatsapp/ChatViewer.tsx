import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WaClient } from "@/lib/whatsapp/client";
import { lowerBound } from "@/lib/whatsapp/format";
import type { Msg, ParsedChat } from "@/lib/whatsapp/types";
import {
  clearChats,
  entryId,
  fileFromEntry,
  getLastId,
  handlePermission,
  listChats,
  putChat,
  removeChat,
  setLastId,
  type LibraryEntry,
} from "@/lib/whatsapp/library";
import { ChatHeader } from "./ChatHeader";
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
  const [lightbox, setLightbox] = useState<{ msg: Msg; url: string } | null>(null);

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

  const handleFile = useCallback(async (file: File, handle?: FileSystemFileHandle) => {
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
      if (!parsed.messages.length) throw new Error("No messages could be read from this export.");
      setChat(parsed);
      setMeIndex(parsed.meIndex);
      setBusy(false);

      const id = entryId(file.name, file.size);
      const now = Date.now();
      await putChat({
        id,
        name: file.name,
        size: file.size,
        addedAt: now,
        lastOpened: now,
        chatName: parsed.chatName,
        msgCount: parsed.messages.length,
        mediaCount: parsed.mediaCount,
        ...(handle ? { handle } : {}),
      });
      setLastId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      client.destroy();
      clientRef.current = null;
    }
    setBusyId(null);
  }, []);

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

  const clearEntries = useCallback(async () => {
    await clearChats();
    void refreshLibrary();
  }, [refreshLibrary]);

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

  const reset = () => {
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
    setLightbox(null);
    void refreshLibrary();
  };

  if (!chat || !clientRef.current) {
    return (
      <DropZone
        onFile={handleFile}
        busy={busy}
        phase={phase}
        pct={pct}
        error={error}
        entries={entries}
        needsPermission={needsPermission}
        busyId={busyId}
        onOpenEntry={openEntry}
        onRemoveEntry={removeEntry}
        onClearEntries={clearEntries}
      />
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-wa-chat">
      <ChatHeader
        chatName={chat.chatName}
        senders={chat.senders}
        meIndex={meIndex}
        onMeChange={setMeIndex}
        total={chat.messages.length}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
        dark={dark}
        onToggleDark={() => setDark((v) => !v)}
        onClose={reset}
      />

      {searchOpen && (
        <SearchBar
          query={query}
          onQuery={setQuery}
          matchCount={matches.length}
          matchPos={matchPos}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          senders={chat.senders}
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
        senders={chat.senders}
        meIndex={meIndex}
        client={clientRef.current}
        query={debounced}
        matchSet={matchSet}
        activeIndex={activeIndex}
        scrollTarget={scrollTarget}
        onOpenMedia={(msg, url) => setLightbox({ msg, url })}
      />

      <footer className="border-t border-wa-divider bg-wa-panel px-4 py-2 text-center text-xs text-wa-meta">
        {view.length.toLocaleString()} of {chat.messages.length.toLocaleString()} messages shown ·{" "}
        {chat.mediaCount.toLocaleString()} attachments · read-only local archive
      </footer>

      <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
    </main>
  );
}
