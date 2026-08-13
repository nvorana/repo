import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UserStore, toPublic, MIN_PASSWORD } from "./users.ts";

function store(): UserStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "users-test-"));
  return new UserStore(path.join(dir, "users.json"));
}

function withRep(): { users: UserStore; id: string } {
  const users = store();
  const u = users.create({
    name: "Edgar",
    email: "edgar@test.local",
    role: "rep",
    password: "originalpw1",
  });
  return { users, id: u.id };
}

afterEach(() => vi.useRealTimers());

describe("password rules", () => {
  it(`rejects passwords under ${MIN_PASSWORD} characters`, () => {
    const users = store();
    expect(() =>
      users.create({ name: "A", email: "a@b.co", role: "rep", password: "short" }),
    ).toThrow(/at least 8/);
  });

  it("never exposes password or reset material to the client", () => {
    const { users, id } = withRep();
    users.createResetToken("edgar@test.local");
    // Cast through unknown: PublicUser has no index signature, and the point of
    // the test is to probe for keys the type says shouldn't be there at all.
    const pub = toPublic(users.getById(id)!) as unknown as Record<string, unknown>;
    expect(pub.hash).toBeUndefined();
    expect(pub.salt).toBeUndefined();
    expect(pub.resetHash).toBeUndefined();
    expect(pub.resetExpiresAt).toBeUndefined();
  });
});

describe("password reset tokens", () => {
  it("issues nothing for an address with no account", () => {
    const { users } = withRep();
    expect(users.createResetToken("stranger@test.local")).toBeNull();
  });

  it("stores only the token's hash, never the token", () => {
    const { users, id } = withRep();
    const issued = users.createResetToken("edgar@test.local")!;
    const stored = users.getById(id)!;
    expect(stored.resetHash).toBeDefined();
    expect(stored.resetHash).not.toBe(issued.token);
    // The raw token must not appear anywhere in the persisted record.
    expect(JSON.stringify(stored)).not.toContain(issued.token);
  });

  it("resets the password and lets the new one log in", () => {
    const { users } = withRep();
    const issued = users.createResetToken("edgar@test.local")!;
    expect(users.resetPasswordWithToken(issued.token, "brandnewpw")).not.toBeNull();
    expect(users.verify("edgar@test.local", "brandnewpw")).not.toBeNull();
    expect(users.verify("edgar@test.local", "originalpw1")).toBeNull();
  });

  it("is single use — a spent token cannot be replayed", () => {
    const { users } = withRep();
    const issued = users.createResetToken("edgar@test.local")!;
    expect(users.resetPasswordWithToken(issued.token, "brandnewpw")).not.toBeNull();
    expect(users.resetPasswordWithToken(issued.token, "attackerpw")).toBeNull();
    // The attacker's password must NOT have taken effect.
    expect(users.verify("edgar@test.local", "attackerpw")).toBeNull();
    expect(users.verify("edgar@test.local", "brandnewpw")).not.toBeNull();
  });

  it("rejects an unknown or empty token", () => {
    const { users } = withRep();
    users.createResetToken("edgar@test.local");
    expect(users.resetPasswordWithToken("not-a-real-token", "brandnewpw")).toBeNull();
    expect(users.resetPasswordWithToken("", "brandnewpw")).toBeNull();
    expect(users.verify("edgar@test.local", "originalpw1")).not.toBeNull();
  });

  it("expires after an hour", () => {
    vi.useFakeTimers();
    const { users } = withRep();
    const issued = users.createResetToken("edgar@test.local")!;
    vi.advanceTimersByTime(61 * 60 * 1000);
    expect(users.resetPasswordWithToken(issued.token, "brandnewpw")).toBeNull();
    expect(users.verify("edgar@test.local", "originalpw1")).not.toBeNull();
  });

  it("is invalidated when the password changes by another route", () => {
    const { users, id } = withRep();
    const issued = users.createResetToken("edgar@test.local")!;
    // e.g. the manager resets it from the People tab in the meantime.
    users.setPassword(id, "managersetpw");
    expect(users.resetPasswordWithToken(issued.token, "attackerpw")).toBeNull();
    expect(users.verify("edgar@test.local", "managersetpw")).not.toBeNull();
  });

  it("issuing a second token invalidates the first", () => {
    const { users } = withRep();
    const first = users.createResetToken("edgar@test.local")!;
    const second = users.createResetToken("edgar@test.local")!;
    expect(users.resetPasswordWithToken(first.token, "attackerpw")).toBeNull();
    expect(users.resetPasswordWithToken(second.token, "brandnewpw")).not.toBeNull();
  });

  it("enforces the minimum length on reset too", () => {
    const { users } = withRep();
    const issued = users.createResetToken("edgar@test.local")!;
    expect(() => users.resetPasswordWithToken(issued.token, "short")).toThrow(/at least 8/);
    // A rejected attempt must not burn the token.
    expect(users.resetPasswordWithToken(issued.token, "goodenough1")).not.toBeNull();
  });

  it("only resets the account the token belongs to", () => {
    const { users } = withRep();
    users.create({ name: "Mike", email: "mike@test.local", role: "manager", password: "mikespw123" });
    const issued = users.createResetToken("edgar@test.local")!;
    users.resetPasswordWithToken(issued.token, "brandnewpw");
    expect(users.verify("mike@test.local", "mikespw123")).not.toBeNull();
  });
});
