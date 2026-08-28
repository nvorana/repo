/**
 * Is this file actually a call recording?
 *
 * Written after finding seven 0-byte uploads in production. One rep submitted
 * the same call four times and another three times; the app accepted every one,
 * queued them, and only failed hours later with a provider error buried in a
 * list. He believed he had submitted seven calls. He had submitted nothing, and
 * nothing told him otherwise.
 *
 * The cost of that is not the lost analysis — it is that a rep who uploads and
 * gets silence learns to stop uploading.
 *
 * So the check runs where he can act on it: the moment he picks the file, in
 * the browser, before anything is sent. The server repeats it because a client
 * check is a courtesy, not a control.
 */

/**
 * Smallest upload we treat as a real recording.
 *
 * A broken export is not merely small, it is structurally empty: 0 bytes, or a
 * few KB of container header with no audio. The real failures measured 0 KB,
 * 9 KB and 15 KB. A genuine consultation call is megabytes — the shortest real
 * call in the corpus is over 2 MB.
 *
 * 64 KB sits far above the broken files and far below anything real. At the
 * bitrates Zoom exports that is well under a minute of audio, which is not a
 * sales call under any reading.
 */
export const MIN_AUDIO_BYTES = 64 * 1024;

function humanSize(bytes: number): string {
  if (bytes <= 0) return "empty";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Why this file can't be used, or null if it's fine.
 *
 * `label` names the track the way the rep sees it in the form, so the message
 * points at the specific input he has to fix rather than at "the upload".
 *
 * The wording deliberately says the RECORDING failed, not that he did something
 * wrong — a 0-byte file is nearly always Zoom stopping before it finished
 * converting, and telling him to check his recordings folder is the one action
 * that actually resolves it.
 */
export function audioFileProblem(label: string, bytes: number): string | null {
  if (bytes >= MIN_AUDIO_BYTES) return null;
  if (bytes <= 0) {
    return `${label} is empty (0 bytes) — the recording didn't save. This usually means the recording was stopped before it finished converting. Check your Zoom recordings folder for the finished file and upload that.`;
  }
  return `${label} is only ${humanSize(bytes)}, which is too small to be a real call — the recording likely didn't finish saving. Check your Zoom recordings folder for the full file.`;
}
