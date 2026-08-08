import { X } from "lucide-react";
import type { Msg } from "@/lib/whatsapp/types";

interface Props {
  item: { msg: Msg; url: string } | null;
  onClose: () => void;
}

export function Lightbox({ item, onClose }: Props) {
  if (!item) return null;
  const { msg, url } = item;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="size-5" />
      </button>
      {msg.kind === "video" ? (
        <video
          src={url}
          controls
          autoPlay
          className="max-h-full max-w-full"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={url}
          alt={msg.file ?? "attachment"}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
