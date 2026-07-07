import { useRef, useState } from "react";
import { sendSupportChat } from "../api.ts";

type Msg = { role: "user" | "assistant"; content: string };
const MAX = 20;

/** Floating support assistant for logged-in users. Answers from help notes; files a ticket otherwise. */
export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const ticketId = useRef<string | undefined>(undefined);
  const atCap = messages.length >= MAX;

  async function send() {
    const text = draft.trim();
    if (!text || sending || atCap) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const res = await sendSupportChat({
        messages: next,
        page: window.location.pathname,
        ticketId: ticketId.current,
      });
      if (res.ticketId) ticketId.current = res.ticketId;
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry — I couldn't send that. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        className="print-hide btn btn-primary btn-circle fixed bottom-5 right-5 z-50 shadow-lg"
        aria-label="Get help"
        onClick={() => setOpen(true)}
      >
        💬
      </button>
    );
  }

  return (
    <div className="print-hide fixed bottom-5 right-5 z-50 flex h-96 w-80 max-w-[calc(100vw-2.5rem)] flex-col rounded-box border border-base-300 bg-base-100 shadow-xl">
      <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
        <span className="text-sm font-semibold">Help &amp; support</span>
        <button className="btn btn-ghost btn-xs" onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-xs opacity-60">
            Hi! Ask me anything about using CallCoach, or describe a problem and I'll get it to the team.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat ${m.role === "user" ? "chat-end" : "chat-start"}`}>
            <div className={`chat-bubble text-sm ${m.role === "user" ? "chat-bubble-primary" : ""}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && <span className="loading loading-dots loading-sm opacity-60" />}
      </div>
      <div className="border-t border-base-300 p-2">
        {atCap ? (
          <p className="p-1 text-xs opacity-60">
            This chat is getting long — reload to start a fresh one for a new issue.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              className="input input-sm input-bordered flex-1"
              placeholder="Type your question…"
              value={draft}
              maxLength={2000}
              disabled={sending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <button className="btn btn-primary btn-sm" disabled={sending || !draft.trim()} onClick={() => void send()}>
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
