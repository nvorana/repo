import { useEffect, useState } from "react";
import { listFrameworks, uploadReview, type FrameworkInfo } from "../api.ts";

interface Props {
  onUploaded: (id: string) => void;
  /** When set, this rep is used and the salesperson field is hidden. */
  fixedRep?: string;
}

type Mode = "single" | "separate";

/** Today's date as YYYY-MM-DD in the user's local timezone. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function UploadCard({ onUploaded, fixedRep }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<FrameworkInfo[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>("");
  const [rep, setRep] = useState<string>(
    () => fixedRep ?? localStorage.getItem("callcoach.rep") ?? "",
  );
  const [client, setClient] = useState<string>("");
  const [callDate, setCallDate] = useState<string>(() => todayLocal());
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem("callcoach.uploadMode") === "separate" ? "separate" : "single"),
  );
  const [single, setSingle] = useState<File | null>(null);
  const [repAudio, setRepAudio] = useState<File | null>(null);
  const [clientAudio, setClientAudio] = useState<File | null>(null);
  const effectiveRep = fixedRep ?? rep;

  useEffect(() => {
    listFrameworks()
      .then((list) => {
        setFrameworks(list);
        const def = list.find((f) => f.isDefault) ?? list[0];
        if (def) setFrameworkId((current) => current || def.id);
      })
      .catch(console.error);
  }, []);

  function pickMode(m: Mode) {
    setMode(m);
    localStorage.setItem("callcoach.uploadMode", m);
  }

  const filesReady = mode === "single" ? !!single : !!repAudio && !!clientAudio;
  const ready = client.trim().length > 0 && filesReady;

  async function submit() {
    if (!ready || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!fixedRep) localStorage.setItem("callcoach.rep", rep);
      const files =
        mode === "single" ? { audio: single! } : { repAudio: repAudio!, clientAudio: clientAudio! };
      const { id } = await uploadReview(files, {
        frameworkId: frameworkId || undefined,
        rep: effectiveRep.trim() || undefined,
        client: client.trim(),
        callDate: callDate || undefined,
      });
      onUploaded(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const accept = "audio/*,.m4a,.mp3,.wav,.ogg,.webm,.flac,.aac";

  return (
    <div className="card bg-base-200">
      <div className="card-body gap-4">
        <div className="flex flex-wrap gap-4">
          {!fixedRep && (
            <label className="flex flex-col">
              <span className="label-text mb-1 text-sm opacity-70">Salesperson</span>
              <input
                type="text"
                value={rep}
                onChange={(e) => setRep(e.target.value)}
                placeholder="e.g. Maria"
                className="input input-bordered input-sm w-44"
              />
            </label>
          )}
          <label className="flex flex-1 flex-col">
            <span className="label-text mb-1 text-sm opacity-70">
              Client name <span className="text-primary">*</span>
            </span>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Who was on the call? e.g. Jenny Reyes"
              className="input input-bordered input-sm w-full"
            />
          </label>
          <label className="flex flex-col">
            <span className="label-text mb-1 text-sm opacity-70">When did this call happen?</span>
            <input
              type="date"
              value={callDate}
              max={todayLocal()}
              onChange={(e) => setCallDate(e.target.value)}
              className="input input-bordered input-sm"
            />
          </label>
          {frameworks.length > 1 && (
            <label className="flex flex-col">
              <span className="label-text mb-1 text-sm opacity-70">Review against</span>
              <select
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
                className="select select-bordered select-sm"
              >
                {frameworks.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Recording type — advisors may have one combined file OR two separate ones */}
        <div role="radiogroup" aria-label="How did you record this call?">
          <span className="label-text mb-2 block text-sm font-medium">
            How did you record this call? <span className="text-primary">*</span>
            <span className="ml-2 font-normal opacity-50">Both work — pick whichever you have.</span>
          </span>
          <div className="grid gap-3 sm:max-w-2xl sm:grid-cols-2">
            {(
              [
                {
                  id: "single",
                  title: "One recording",
                  desc: "A single combined file of the whole call.",
                },
                {
                  id: "separate",
                  title: "Two files — one per person",
                  desc: "Each person's own audio file.",
                  badge: "Most accurate",
                },
              ] as const
            ).map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => pickMode(opt.id)}
                  className={`flex items-start gap-3 rounded-box border-2 p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-base-300 hover:border-base-content/30"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      active ? "border-primary" : "border-base-content/30"
                    }`}
                  >
                    {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold">
                      {opt.title}
                      {"badge" in opt && opt.badge && (
                        <span className="badge badge-success badge-sm">{opt.badge}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs opacity-60">{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {mode === "single" ? (
          <>
            <div className="rounded-box border border-warning/30 bg-warning/5 p-3 text-sm">
              One combined recording works, but the <span className="font-semibold">talk-time %</span> is
              estimated (the app has to guess who's speaking) and may be off. For an exact ratio, record
              each person separately — in Zoom, turn on “Record a separate audio file of each
              participant” — then choose <span className="font-semibold">Two files</span> above.
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Call recording <span className="text-primary">*</span>
              </span>
              <input
                type="file"
                accept={accept}
                className="file-input file-input-bordered file-input-sm w-full max-w-md"
                onChange={(e) => setSingle(e.target.files?.[0] ?? null)}
              />
              {single && <span className="truncate text-xs opacity-60">{single.name}</span>}
            </label>
          </>
        ) : (
          <>
            <div className="rounded-box border border-info/30 bg-info/5 p-3 text-sm">
              Upload <span className="font-semibold">each person's own audio file</span> from the call
              (in Zoom: “Record a separate audio file of each participant”). This gives an exact
              measure of who spoke how long.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Your recording (the rep) <span className="text-primary">*</span>
                </span>
                <input
                  type="file"
                  accept={accept}
                  className="file-input file-input-bordered file-input-sm w-full"
                  onChange={(e) => setRepAudio(e.target.files?.[0] ?? null)}
                />
                {repAudio && <span className="truncate text-xs opacity-60">{repAudio.name}</span>}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Client's recording <span className="text-primary">*</span>
                </span>
                <input
                  type="file"
                  accept={accept}
                  className="file-input file-input-bordered file-input-sm w-full"
                  onChange={(e) => setClientAudio(e.target.files?.[0] ?? null)}
                />
                {clientAudio && <span className="truncate text-xs opacity-60">{clientAudio.name}</span>}
              </label>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!ready || busy}
            className="btn btn-primary btn-sm"
          >
            {busy ? <span className="loading loading-spinner loading-sm" /> : "Review call"}
          </button>
          {!ready && !busy && (
            <span className="text-xs opacity-50">
              {mode === "single"
                ? "Add the client name and a recording to continue."
                : "Add the client name and both audio files to continue."}
            </span>
          )}
        </div>

        {error && (
          <div className="alert alert-error py-2 text-sm">
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
