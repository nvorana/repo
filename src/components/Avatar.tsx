import { useState } from "react";
import { userAvatarUrl } from "../api.ts";

// A round profile photo that falls back to a deterministic colored circle with
// the person's initials when there's no photo (or the image fails to load, or
// we don't have a stable user id — e.g. legacy calls uploaded before accounts).
const COLORS = [
  "bg-primary text-primary-content",
  "bg-secondary text-secondary-content",
  "bg-accent text-accent-content",
  "bg-info text-info-content",
  "bg-success text-success-content",
  "bg-warning text-warning-content",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({
  userId,
  name,
  size = 40,
  className = "",
}: {
  userId?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size, minWidth: size };
  const showImg = Boolean(userId) && !failed;

  if (showImg) {
    return (
      <img
        src={userAvatarUrl(userId!)}
        alt={name}
        width={size}
        height={size}
        style={dim}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={dim}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${colorFor(
        userId ?? name,
      )} ${className}`}
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
    </div>
  );
}
