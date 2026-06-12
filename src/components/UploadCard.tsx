import { useEffect, useRef, useState } from "react";
import { listFrameworks, uploadReview, type FrameworkInfo } from "../api.ts";

interface Props {
  onUploaded: (id: string) => void;
}

export function UploadCard({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<FrameworkInfo[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>("");
  const [rep, setRep] = useState<string>(() => localStorage.getItem("callcoach.rep") ?? "");

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
    setError(null);
    setBusy(true);
    try {
      localStorage.setItem("callcoach.rep", rep);
      const { id } = await uploadReview(file, frameworkId || undefined, rep.trim() || undefined);
      onUploaded(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging
            ? "border-amber-400 bg-amber-400/10"
            : "border-slate-600 bg-slate-800/40 hover:border-slate-400"
        }`}
      >
        <p className="text-lg font-medium text-slate-100">
          {busy ? "Uploading…" : "Drop a call recording here"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          or click to browse — mp3, m4a, wav, ogg, webm
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm,.flac,.aac"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <label htmlFor="rep" className="text-sm text-slate-400">
            Salesperson:
          </label>
          <input
            id="rep"
            type="text"
            value={rep}
            onChange={(e) => setRep(e.target.value)}
            placeholder="e.g. Maria"
            className="w-44 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>
        {frameworks.length > 1 && (
          <div className="flex items-center gap-3">
            <label htmlFor="framework" className="text-sm text-slate-400">
              Review against:
            </label>
            <select
              id="framework"
              value={frameworkId}
              onChange={(e) => setFrameworkId(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
            >
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
