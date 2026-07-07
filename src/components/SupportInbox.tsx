import { useEffect, useState } from "react";
import { listSupportTickets, resolveSupportTicket, type SupportTicket } from "../api.ts";

/** Manager view of support tickets the assistant couldn't resolve. */
export function SupportInbox() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    listSupportTickets().then(setTickets).catch(() => {});
  }, []);

  const open = tickets.filter((t) => t.status === "open");
  const resolved = tickets.filter((t) => t.status === "resolved");
  if (tickets.length === 0) return null;

  async function resolve(id: string) {
    try {
      const updated = await resolveSupportTicket(id);
      setTickets((ts) => ts.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      /* ignore — next load reflects truth */
    }
  }

  return (
    <section className="print-hide">
      <h2 className="mb-3 text-lg font-semibold">Support requests</h2>
      {open.length === 0 && <p className="text-sm opacity-60">No open requests.</p>}
      <div className="space-y-3">
        {open.map((t) => (
          <div key={t.id} className="card border-l-4 border-warning bg-base-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{t.aiSummary}</p>
              <button className="btn btn-ghost btn-xs shrink-0" onClick={() => void resolve(t.id)}>
                Mark resolved
              </button>
            </div>
            <p className="mt-1 text-xs opacity-50">
              {t.userName ?? "Someone"} · {t.page} · {new Date(t.createdAt).toLocaleString()}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs opacity-70">Conversation</summary>
              <div className="mt-2 space-y-1">
                {t.messages.map((m, i) => (
                  <p key={i} className="text-sm">
                    <span className="font-medium opacity-60">{m.role === "user" ? "User" : "AI"}:</span>{" "}
                    {m.content}
                  </p>
                ))}
              </div>
              <p className="mt-1 text-xs opacity-40">{t.userAgent}</p>
            </details>
          </div>
        ))}
      </div>
      {resolved.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm opacity-70">Resolved ({resolved.length})</summary>
          <ul className="mt-2 space-y-1">
            {resolved.map((t) => (
              <li key={t.id} className="text-sm opacity-70">
                {t.aiSummary} — {t.userName ?? "Someone"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
