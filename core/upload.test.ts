import { describe, expect, it } from "vitest";
import { MIN_AUDIO_BYTES, audioFileProblem } from "./upload.ts";

const KB = 1024;
const MB = 1024 * 1024;

describe("audioFileProblem", () => {
  it("rejects the 0-byte upload that started this", () => {
    // Seven of these reached production. Both tracks, zero bytes, accepted.
    const problem = audioFileProblem("Your recording", 0);
    expect(problem).toContain("empty");
    expect(problem).toContain("didn't save");
  });

  it("names the track it is complaining about", () => {
    // The message sits under one specific file input, so it has to point at
    // that input rather than at "the upload".
    expect(audioFileProblem("The client's recording", 0)).toContain("The client's recording");
    expect(audioFileProblem("Your recording", 0)).toContain("Your recording");
  });

  it("tells the rep where to go rather than that he did it wrong", () => {
    // A 0-byte file is almost always Zoom stopping before it finished
    // converting. Pointing at the recordings folder is the one action that
    // actually fixes it.
    expect(audioFileProblem("Your recording", 0)).toContain("recordings folder");
  });

  it.each([
    ["Ferdie's empty tracks", 0],
    ["Cherry Mae's silent client track", 9 * KB],
    ["Ralph Lacson's stub", 15 * KB],
  ])("rejects %s", (_name, bytes) => {
    expect(audioFileProblem("This recording", bytes)).not.toBeNull();
  });

  it("reports the size back for anything non-empty, so it is checkable", () => {
    expect(audioFileProblem("This recording", 15 * KB)).toContain("15 KB");
  });

  it("accepts a real call", () => {
    // The shortest genuine call in the corpus is comfortably over 2 MB.
    expect(audioFileProblem("This recording", 2 * MB)).toBeNull();
    expect(audioFileProblem("This recording", 40 * MB)).toBeNull();
  });

  it("draws the line where a broken file cannot reach and a real one cannot fall", () => {
    expect(audioFileProblem("This recording", MIN_AUDIO_BYTES)).toBeNull();
    expect(audioFileProblem("This recording", MIN_AUDIO_BYTES - 1)).not.toBeNull();
    // Far above every observed broken file, far below every real one.
    expect(MIN_AUDIO_BYTES).toBeGreaterThan(15 * KB);
    expect(MIN_AUDIO_BYTES).toBeLessThan(2 * MB);
  });
});
