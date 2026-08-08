import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { ChatViewer } from "@/components/whatsapp/ChatViewer";

const title = "Chat Replay — Open a WhatsApp Export as a Real Chat";
const description =
  "Drop a WhatsApp export .zip and read it back as a real WhatsApp-style chat with media, search and timestamps. Fully local: nothing is uploaded.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-wa-chat">
          <p className="text-sm text-wa-meta">Loading chat viewer…</p>
        </div>
      }
    >
      <ChatViewer />
    </ClientOnly>
  );
}
