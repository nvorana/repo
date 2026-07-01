import { useEffect, useState } from "react";
import { listFrameworks, uploadReview, type FrameworkInfo } from "../api.ts";

interface Props {
  onUploaded: (id: string) => void;
  /** When set, this rep is used and the salesperson field is hidden. */
  fixedRep?: string;
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

  const ready = client.trim().length > 0 && !!repAudio && !!clientAudio;

  async function submit() {
    if (!ready || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!fixedRep) localStorage.setItem("callcoach.rep", rep);
      const { id } = await uploadReview(
        { repAudio: repAudio!, clientAudio: clientAudio! },
        {
          frameworkId: frameworkId || undefined,
          rep: effectiveRep.trim() || undefined,
          client: client.trim(),
        },
      );
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

        <div className="rounded-box border border-info/30 bg-info/5 p-3 text-sm">
          Upload <span className="font-semibold">each person's own audio file</span> from the call.
          In Zoom, turn on “Record a separate audio file of each participant.” Separate tracks let us
          measure exactly who spoke how long.
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
              Add the client name and both audio files to continue.
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
