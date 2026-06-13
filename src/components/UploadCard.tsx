import { useEffect, useRef, useState } from "react";
import { listFrameworks, uploadReview, type FrameworkInfo } from "../api.ts";

interface Props {
  onUploaded: (id: string) => void;
  /** When set, this rep is used and the salesperson field is hidden. */
  fixedRep?: string;
}

export function UploadCard({ onUploaded, fixedRep }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<FrameworkInfo[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>("");
  const [rep, setRep] = useState<string>(
    () => fixedRep ?? localStorage.getItem("callcoach.rep") ?? "",
  );
  const [client, setClient] = useState<string>("");
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

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    if (!client.trim()) {
      setError("Enter the client's name before uploading.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (!fixedRep) localStorage.setItem("callcoach.rep", rep);
      const { id } = await uploadReview(file, {
        frameworkId: frameworkId || undefined,
        rep: effectiveRep.trim() || undefined,
        client: client.trim(),
      });
      onUploaded(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const ready = client.trim().length > 0;

  function openPicker() {
    if (!ready) {
      setError("Enter the client's name first.");
      return;
    }
    inputRef.current?.click();
  }

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

        <div
          role="button"
          tabIndex={0}
          aria-disabled={!ready}
          onClick={openPicker}
          onKeyDown={(e) => e.key === "Enter" && openPicker()}
          onDragOver={(e) => {
            e.preventDefault();
            if (ready) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files[0]);
          }}
          className={`cursor-pointer rounded-box border-2 border-dashed p-10 text-center transition-colors ${
            dragging
              ? "border-primary bg-primary/10"
              : ready
                ? "border-base-content/20 hover:border-base-content/40"
                : "border-base-content/10 opacity-50"
          }`}
        >
          {busy ? (
            <span className="loading loading-spinner loading-lg text-primary" />
          ) : (
            <>
              <p className="text-lg font-medium">Drop a call recording here</p>
              <p className="mt-1 text-sm opacity-60">or click to browse — mp3, m4a, wav, ogg, webm</p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm,.flac,.aac"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {error && (
          <div className="alert alert-error py-2 text-sm">
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
