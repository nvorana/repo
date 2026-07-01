import { useEffect, useState } from "react";
import {
  createUser,
  deleteUser,
  deleteUserAvatar,
  listUsers,
  resetUserPassword,
  uploadUserAvatar,
  type AppUser,
  type Role,
} from "../api.ts";
import { Avatar } from "./Avatar.tsx";

export function UsersAdmin() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add-user form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("rep");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Bumped on every refresh so a just-uploaded photo remounts the <Avatar> and
  // bypasses the browser's cache of the (unchanged) image URL.
  const [version, setVersion] = useState(0);

  function refresh() {
    listUsers()
      .then((u) => {
        setUsers(u);
        setVersion((v) => v + 1);
      })
      .catch((e) => setError(String(e)));
  }
  useEffect(refresh, []);

  async function onPickPhoto(u: AppUser, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await uploadUserAvatar(u.id, file);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo");
    }
  }

  async function removePhoto(u: AppUser) {
    if (!window.confirm(`Remove ${u.name}'s photo?`)) return;
    try {
      await deleteUserAvatar(u.id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createUser(name.trim(), email.trim(), role, password);
      setName("");
      setEmail("");
      setPassword("");
      setRole("rep");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(u: AppUser) {
    const pw = window.prompt(`New password for ${u.name}:`);
    if (!pw) return;
    try {
      await resetUserPassword(u.id, pw);
      window.alert(`Password updated for ${u.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset");
    }
  }

  async function remove(u: AppUser) {
    if (!window.confirm(`Remove ${u.name}? They will no longer be able to log in.`)) return;
    try {
      await deleteUser(u.id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove");
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-1 text-2xl font-bold">People</h1>
        <p className="opacity-60">
          Add a login for each salesperson. They sign in with the name and password you set here —
          and see only their own calls.
        </p>
      </section>

      <section className="card bg-base-200">
        <form onSubmit={add} className="card-body gap-4">
          <h2 className="font-semibold">Add a person</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col">
              <span className="mb-1 text-sm opacity-70">First name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maria"
                className="input input-bordered input-sm w-40"
              />
            </label>
            <label className="flex flex-col">
              <span className="mb-1 text-sm opacity-70">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@company.com"
                className="input input-bordered input-sm w-56"
              />
            </label>
            <label className="flex flex-col">
              <span className="mb-1 text-sm opacity-70">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="select select-bordered select-sm"
              >
                <option value="rep">Salesperson</option>
                <option value="manager">Sales head</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="mb-1 text-sm opacity-70">Password</span>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="set a password"
                className="input input-bordered input-sm w-40"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !name.trim() || !email.trim() || password.length < 4}
              className="btn btn-primary btn-sm"
            >
              {busy ? <span className="loading loading-spinner loading-sm" /> : "Add"}
            </button>
          </div>
          <p className="text-xs opacity-50">
            Share the email + password with the person — that's how they log in. They can't change it
            themselves; you reset it here if needed.
          </p>
          {error && (
            <div className="alert alert-error py-2 text-sm">
              <span>{error}</span>
            </div>
          )}
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Accounts ({users.length})</h2>
        <ul className="space-y-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-box bg-base-200 px-4 py-3"
            >
              <Avatar key={`${u.id}-${version}`} userId={u.id} name={u.name} size={44} />
              <div className="min-w-0">
                <span className="font-medium">{u.name}</span>
                <span className="ml-2 text-sm opacity-50">{u.email}</span>
              </div>
              <span
                className={`badge badge-sm ${u.role === "manager" ? "badge-secondary" : "badge-ghost"}`}
              >
                {u.role === "manager" ? "Sales head" : "Salesperson"}
              </span>
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <label className="btn btn-ghost btn-xs">
                  {u.hasAvatar ? "Change photo" : "Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void onPickPhoto(u, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {u.hasAvatar && (
                  <button onClick={() => void removePhoto(u)} className="btn btn-ghost btn-xs text-error">
                    Remove photo
                  </button>
                )}
                <button onClick={() => void resetPassword(u)} className="btn btn-ghost btn-xs">
                  Reset password
                </button>
                <button onClick={() => void remove(u)} className="btn btn-ghost btn-xs text-error">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
