import { X } from "lucide-react";
import type { Msg } from "@/lib/whatsapp/types";
import { Button } from "@/components/ui/button";

interface Props {
  item: { msg: Msg; url: string } | null;
  onClose: () => void;
}

export function Lightbox({ item, onClose }: Props) {
  if (!item) return null;
  const { msg, url } = item;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wa-panel-foreground/95 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 rounded-full bg-wa-panel/10 text-wa-panel hover:bg-wa-panel/20"
      >
        <X className="size-5" />
      </Button>
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
