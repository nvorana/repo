import { useRef, useState } from "react";
import { uploadReview } from "../api.ts";

interface Props {
  onUploaded: (id: string) => void;
}

export function UploadCard({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    setBusy(true);
    try {
      const { id } = await uploadReview(file);
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
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
