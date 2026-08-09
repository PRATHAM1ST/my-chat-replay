import { Component, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Logo } from "./Logo";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence around the viewer. A render crash without this unmounts
 * the whole tree to a white page with the reason buried in the console — the
 * exact "the app just went blank" report. This keeps the failure on-brand and
 * hands the user the one action that always works.
 */
export class ChatErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="wa-doodle flex min-h-[100dvh] items-center justify-center px-6">
        <div className="relative z-10 w-full max-w-sm rounded-2xl bg-wa-surface p-8 text-center shadow-[var(--wa-shadow-panel)]">
          <Logo size={44} className="mx-auto" />
          <h1 className="mt-4 text-[20px] font-medium text-wa-panel-foreground">Something broke</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-wa-meta">
            The viewer hit an error it could not recover from. Your chats and their settings are
            safe on this device — reloading brings everything back.
          </p>
          <p className="mt-3 truncate rounded-lg bg-wa-input px-3 py-2 text-[12px] text-wa-meta">
            {this.state.error.message || String(this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-wa-green px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-wa-teal"
          >
            <RotateCcw className="size-4" /> Reload app
          </button>
        </div>
      </main>
    );
  }
}
