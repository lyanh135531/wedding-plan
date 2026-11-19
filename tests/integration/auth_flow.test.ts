import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import { headers as nextHeaders } from "next/headers";
import { pool, db } from "@/db/client";
import { auth, validateLoginEligibility } from "@/lib/auth/auth";
import {
  getCurrentSession,
  SessionStoreUnavailableError,
  revokeFamilyMemberAccess,
  requireAuthenticatedSession,
  requireOwnerSession,
  canAccessEvent,
  UserSession,
} from "@/lib/auth/session";
import {
  createFamilyInvite,
  redeemFamilyInvite,
  revokeFamilyInvite,
  InviteError,
} from "@/lib/auth/invites";
import { seedOwners } from "../../scripts/seed-owners";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

function signedSessionCookie(token: string, secret = auth.options.secret!) {
  const signature = crypto.createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

// ==============================================================================
// High-Fidelity Stateful In-Memory Database Simulator for Auth & Permissions
// ==============================================================================

interface MockUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: "owner" | "family_view";
  createdAt: Date;
  updatedAt: Date;
}

interface MockSession {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

interface MockInvite {
  id: string;
  email: string;
  tokenHash: string;
  role: "owner" | "family_view";
  allowedEventIds: string[];
  expiresAt: Date;
  invitedByUserId: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: Date;
}

interface MockEventAccess {
  id: string;
  userId: string;
  eventId: string;
  createdAt: Date;
}

interface MockAuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  afterState: any;
  createdAt: Date;
}

class InMemoryAuthDatabase {
  public users = new Map<string, MockUser>();
  public sessions = new Map<string, MockSession>();
  public memberInvites = new Map<string, MockInvite>();
  public memberEventAccess: MockEventAccess[] = [];
  public auditLogs: MockAuditLog[] = [];
  public events: { id: string; name: string }[] = [];

  clear() {
    this.users.clear();
    this.sessions.clear();
    this.memberInvites.clear();
    this.memberEventAccess = [];
    this.auditLogs = [];
    this.events = [];
  }

  async handleQuery(queryObj: any, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const text: string = typeof queryObj === "string" ? queryObj : queryObj.text || "";
    const isArrayMode = queryObj?.rowMode === "array";
    const trimmed = text.trim();

    // Transaction controls
    if (/^(BEGIN|COMMIT|ROLLBACK);?$/i.test(trimmed)) {
      return { rows: [], rowCount: 0 };
    }

    // -------------------------------------------------------------
    // USERS Table Queries
    // -------------------------------------------------------------
    if (/select .* from "users" where/i.test(trimmed)) {
      let matchedUsers: MockUser[] = [];
      const emailParam = params.find((p) => typeof p === "string" && p.includes("@"));
      const idParam = params.find((p) => typeof p === "string" && !p.includes("@") && p.length > 10);

      for (const u of this.users.values()) {
        if (emailParam && u.email.toLowerCase() === emailParam.toLowerCase()) {
          matchedUsers.push(u);
        } else if (idParam && u.id === idParam) {
          matchedUsers.push(u);
        }
      }

      if (isArrayMode) {
        const rows = matchedUsers.map((u) => [
          u.id,
          u.name,
          u.email,
          u.emailVerified,
          u.image,
          u.role,
          u.createdAt,
          u.updatedAt,
        ]);
        return { rows, rowCount: rows.length };
      }
      return { rows: matchedUsers, rowCount: matchedUsers.length };
    }

    if (/select .* from "users"/i.test(trimmed)) {
      const allUsers = Array.from(this.users.values());
      if (isArrayMode) {
        const rows = allUsers.map((u) => [
          u.id,
          u.name,
          u.email,
          u.emailVerified,
          u.image,
          u.role,
          u.createdAt,
          u.updatedAt,
        ]);
        return { rows, rowCount: rows.length };
      }
      return { rows: allUsers, rowCount: allUsers.length };
    }

    if (/insert into "users"/i.test(trimmed)) {
      const id = params[0] || crypto.randomUUID();
      const name = params[1] || "Chủ sở hữu";
      const email = params[2];
      const role = (params.find((p) => p === "owner" || p === "family_view") || "family_view") as
        | "owner"
        | "family_view";

      const newUser: MockUser = {
        id,
        name,
        email,
        emailVerified: false,
        image: null,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(id, newUser);
      return { rows: [], rowCount: 1 };
    }

    if (/update "users" set "role" = \$\d+ where "users"\."id" = \$\d+/i.test(trimmed)) {
      const role = params[0] as "owner" | "family_view";
      const id = params[1];
      const existing = this.users.get(id);
      if (existing) {
        existing.role = role;
        existing.updatedAt = new Date();
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/UPDATE users\s+SET role =/i.test(trimmed)) {
      const id = params[0];
      const existing = this.users.get(id);
      if (existing) {
        if (existing.role !== "owner") {
          existing.role = "family_view";
        }
        existing.updatedAt = new Date();
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // -------------------------------------------------------------
    // SESSIONS Table Queries & SESSIONS INNER JOIN USERS
    // -------------------------------------------------------------
    if (/from "sessions"\s+inner join "users"/i.test(trimmed)) {
      const token = params[0];
      const now = new Date();

      const matchedRows: any[] = [];
      for (const s of this.sessions.values()) {
        if (s.token === token && s.expiresAt > now) {
          const u = this.users.get(s.userId);
          if (u) {
            if (isArrayMode) {
              matchedRows.push([
                s.id,
                s.userId,
                s.expiresAt,
                s.token,
                u.id,
                u.name,
                u.email,
                u.role,
                u.image,
              ]);
            } else {
              matchedRows.push({
                sessionId: s.id,
                sessionUserId: s.userId,
                sessionExpiresAt: s.expiresAt,
                sessionToken: s.token,
                userId: u.id,
                userName: u.name,
                userEmail: u.email,
                userRole: u.role,
                userImage: u.image,
              });
            }
          }
        }
      }
      return { rows: matchedRows, rowCount: matchedRows.length };
    }

    if (/DELETE FROM sessions WHERE user_id = \$\d+/i.test(trimmed)) {
      const targetUserId = params[0];
      let count = 0;
      for (const [sId, s] of Array.from(this.sessions.entries())) {
        if (s.userId === targetUserId) {
          this.sessions.delete(sId);
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    // -------------------------------------------------------------
    // MEMBER_INVITES Table Queries
    // -------------------------------------------------------------
    if (/insert into "member_invites"/i.test(trimmed)) {
      const id = params[0] || crypto.randomUUID();
      const email = params[1];
      const tokenHash = params[2];
      const role = params[3] || "family_view";

      let allowedEventIds: string[] = [];
      if (Array.isArray(params[4])) {
        allowedEventIds = params[4];
      } else if (typeof params[4] === "string") {
        const matches = params[4].match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
        if (matches) allowedEventIds = matches;
      }

      const expiresAt = new Date(params[5]);
      const invitedByUserId = params[6];

      const newInvite: MockInvite = {
        id,
        email,
        tokenHash,
        role: role as "owner" | "family_view",
        allowedEventIds,
        expiresAt,
        invitedByUserId,
        status: "pending",
        createdAt: new Date(),
      };
      this.memberInvites.set(id, newInvite);
      return { rows: [], rowCount: 1 };
    }

    if (/select .* from "member_invites"/i.test(trimmed)) {
      let matchedInvites: MockInvite[] = [];
      const hashParam = params.find((p) => typeof p === "string" && p.length === 64);
      const emailParam = params.find((p) => typeof p === "string" && p.includes("@"));
      const idParam = params.find((p) => typeof p === "string" && !p.includes("@") && p.length !== 64);

      for (const inv of this.memberInvites.values()) {
        if (idParam && inv.id === idParam) {
          matchedInvites.push(inv);
        } else if (hashParam && inv.tokenHash === hashParam) {
          matchedInvites.push(inv);
        } else if (emailParam && inv.email.toLowerCase() === emailParam.toLowerCase()) {
          matchedInvites.push(inv);
        }
      }

      if (isArrayMode) {
        const rows = matchedInvites.map((inv) => [
          inv.id,
          inv.email,
          inv.tokenHash,
          inv.role,
          inv.allowedEventIds,
          inv.expiresAt,
          inv.invitedByUserId,
          inv.status,
          inv.createdAt,
        ]);
        return { rows, rowCount: rows.length };
      }
      return { rows: matchedInvites, rowCount: matchedInvites.length };
    }

    if (/UPDATE member_invites\s+SET status = 'accepted'\s+WHERE id = \$1 AND status = 'pending'/i.test(trimmed)) {
      const inviteId = params[0];
      const inv = this.memberInvites.get(inviteId);
      if (inv && inv.status === "pending") {
        inv.status = "accepted";
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/UPDATE member_invites\s+SET status = 'revoked'/i.test(trimmed)) {
      const emailOrUserParam = params[0];
      let count = 0;
      for (const inv of this.memberInvites.values()) {
        const user = this.users.get(emailOrUserParam);
        if (inv.email === emailOrUserParam || (user && inv.email === user.email)) {
          inv.status = "revoked";
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (/update "member_invites" set "status" = \$\d+ where "member_invites"\."id" = \$\d+/i.test(trimmed)) {
      const status = params[0];
      const inviteId = params[1];
      const inv = this.memberInvites.get(inviteId);
      if (inv) {
        inv.status = status;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // -------------------------------------------------------------
    // MEMBER_EVENT_ACCESS Table Queries
    // -------------------------------------------------------------
    if (/from "member_event_access" where "member_event_access"\."user_id" = \$\d+/i.test(trimmed)) {
      const userId = params[0];
      const accesses = this.memberEventAccess.filter((a) => a.userId === userId);
      if (isArrayMode) {
        const rows = accesses.map((a) => [a.eventId]);
        return { rows, rowCount: rows.length };
      }
      return { rows: accesses.map((a) => ({ eventId: a.eventId })), rowCount: accesses.length };
    }

    if (/INSERT INTO member_event_access/i.test(trimmed)) {
      const userId = params[0];
      const eventId = params[1];
      const exists = this.memberEventAccess.some(
        (a) => a.userId === userId && a.eventId === eventId
      );
      if (!exists) {
        this.memberEventAccess.push({
          id: crypto.randomUUID(),
          userId,
          eventId,
          createdAt: new Date(),
        });
      }
      return { rows: [], rowCount: 1 };
    }

    if (/DELETE FROM member_event_access WHERE user_id = \$\d+/i.test(trimmed)) {
      const userId = params[0];
      const prevLen = this.memberEventAccess.length;
      this.memberEventAccess = this.memberEventAccess.filter((a) => a.userId !== userId);
      return { rows: [], rowCount: prevLen - this.memberEventAccess.length };
    }

    // -------------------------------------------------------------
    // AUDIT_LOGS Table Queries
    // -------------------------------------------------------------
    if (/audit_logs/i.test(trimmed)) {
      let action = "LOG";
      let userId = "system";
      let entityType = "SYSTEM";
      let entityId = crypto.randomUUID();
      let afterState = null;

      const literalActionMatch = trimmed.match(/'([A-Z_]+)'/);
      if (literalActionMatch) {
        action = literalActionMatch[1];
        userId = params[0] || "system";
        afterState = params[1] || null;
      } else if (params.length >= 3) {
        userId = params[1] || "system";
        action = params[2] || "LOG";
        entityType = params[3] || "SYSTEM";
        entityId = params[4] || crypto.randomUUID();
        afterState = params[5] || null;
      }

      this.auditLogs.push({
        id: crypto.randomUUID(),
        userId,
        action,
        entityType,
        entityId,
        afterState,
        createdAt: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

// Global in-memory instance
const mockDb = new InMemoryAuthDatabase();

// ==============================================================================
// Test Suites
// ==============================================================================

describe("Milestone 3 Auth & Security Acceptance Tests (AT02, AT04, AT49, AT50)", () => {
  const testGroomEmail = "groom.test@wedding.local";
  const testBrideEmail = "bride.test@wedding.local";
  const testFamilyEmail = "family.test@wedding.local";
  const testStrangerEmail = "stranger.test@wedding.local";

  const testEventId = "00000000-0000-4000-8000-000000000001";
  let ownerUserId: string;

  beforeEach(() => {
    mockDb.clear();

    // Mock pool.query and pool.connect to route through stateful InMemoryAuthDatabase
    vi.spyOn(pool, "query").mockImplementation((queryObj: any, params?: any) => {
      return mockDb.handleQuery(queryObj, params) as any;
    });

    vi.spyOn(pool, "connect").mockImplementation(async () => {
      return {
        query: (queryObj: any, params?: any) => mockDb.handleQuery(queryObj, params),
        release: () => {},
      } as any;
    });

    // Pre-seed Groom Owner
    ownerUserId = crypto.randomUUID();
    mockDb.users.set(ownerUserId, {
      id: ownerUserId,
      name: "Test Groom",
      email: testGroomEmail,
      emailVerified: true,
      image: null,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockDb.events.push({ id: testEventId, name: "Tiệc Cưới Chính" });
  });

  // ============================================================================
  // AT02 & AT49: Owner Seeding, Stranger Blocking, Idempotent Reseed
  // ============================================================================
  describe("AT02 & AT49: Owner Seeding, Stranger Blocking, Idempotent Reseed", () => {
    it("preserves owner role and prevents duplicate owner creation upon re-seed (AT49)", async () => {
      // 1. Initial seed with groom and bride
      const seedResult1 = await seedOwners(testGroomEmail, testBrideEmail);
      expect(seedResult1.owners.length).toBe(2);

      const groomStatus1 = seedResult1.owners.find((o) => o.email === testGroomEmail);
      const brideStatus1 = seedResult1.owners.find((o) => o.email === testBrideEmail);
      expect(groomStatus1?.status).toBe("already_owner"); // Groom was pre-seeded
      expect(brideStatus1?.status).toBe("created");       // Bride was newly created

      // 2. Re-run identical seed command (idempotency check)
      const seedResult2 = await seedOwners(testGroomEmail, testBrideEmail);
      expect(seedResult2.owners.length).toBe(2);

      const groomStatus2 = seedResult2.owners.find((o) => o.email === testGroomEmail);
      const brideStatus2 = seedResult2.owners.find((o) => o.email === testBrideEmail);
      expect(groomStatus2?.status).toBe("already_owner");
      expect(brideStatus2?.status).toBe("already_owner");

      // Verify users table contains exactly 2 owners with these emails (0 duplicates)
      const allUsers = Array.from(mockDb.users.values());
      const testOwners = allUsers.filter((u) => u.email.endsWith(".test@wedding.local"));
      expect(testOwners.length).toBe(2);
      expect(testOwners.every((u) => u.role === "owner")).toBe(true);
    });

    it("rejects seeding when two identical emails are supplied (AT49)", async () => {
      await expect(
        seedOwners(testGroomEmail, testGroomEmail)
      ).rejects.toThrow("The two owner email addresses must be distinct.");
    });

    it("rejects seeding when an invalid email format is supplied (AT49)", async () => {
      await expect(
        seedOwners("not-a-valid-email", testBrideEmail)
      ).rejects.toThrow("Invalid owner email 1");

      await expect(
        seedOwners(testGroomEmail, "another-invalid-email")
      ).rejects.toThrow("Invalid owner email 2");
    });

    it("ensures uninvited stranger has zero privileges and cannot sign in (AT02)", async () => {
      // Stranger is not pre-seeded and has no invite
      const eligibility = await validateLoginEligibility(testStrangerEmail);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain("STRANGER_BLOCKED");

      // Check databaseHooks hook
      const hook = (auth.options.databaseHooks as any)?.user?.create?.before;
      expect(hook).toBeDefined();

      const hookResult = await hook({
        id: "stranger-id",
        name: "Stranger Danger",
        email: testStrangerEmail,
      });

      // Hook returns false to abort user creation in Better Auth (AT02)
      expect(hookResult).toBe(false);

      // Stranger must have zero record in users
      const strangerInDb = Array.from(mockDb.users.values()).find(
        (u) => u.email === testStrangerEmail
      );
      expect(strangerInDb).toBeUndefined();
    });

    it("permits pre-seeded owner to complete initial sign-in with owner role (AT02)", async () => {
      const eligibility = await validateLoginEligibility(testGroomEmail);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.role).toBe("owner");

      const hook = (auth.options.databaseHooks as any)?.user?.create?.before;
      const hookResult = await hook({
        id: ownerUserId,
        name: "Test Groom",
        email: testGroomEmail,
      });

      expect(hookResult).not.toBe(false);
      expect(hookResult.data.role).toBe("owner");
    });
  });

  // ============================================================================
  // AT04: Immediate Session Revocation Effect
  // ============================================================================
  describe("AT04: Immediate Session Revocation Effect", () => {
    it("immediately invalidates active session when owner revokes member access", async () => {
      // 1. Create family user and session
      const familyUserId = crypto.randomUUID();
      mockDb.users.set(familyUserId, {
        id: familyUserId,
        name: "Test Family Member",
        email: testFamilyEmail,
        emailVerified: true,
        image: null,
        role: "family_view",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDb.memberEventAccess.push({
        id: crypto.randomUUID(),
        userId: familyUserId,
        eventId: testEventId,
        createdAt: new Date(),
      });

      const sessionToken = `test_token_${crypto.randomBytes(16).toString("hex")}`;
      const sessionId = crypto.randomUUID();
      mockDb.sessions.set(sessionId, {
        id: sessionId,
        userId: familyUserId,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      });

      // 2. Verify active session lookup via Bearer token
      const reqHeaders = new Headers();
      reqHeaders.set("authorization", `Bearer ${sessionToken}`);

      const activeSession = await getCurrentSession(reqHeaders);
      expect(activeSession).not.toBeNull();
      expect(activeSession?.user.id).toBe(familyUserId);
      expect(activeSession?.role).toBe("family_view");
      expect(activeSession?.allowedEventIds).toContain(testEventId);

      // Verify canAccessEvent helper
      expect(canAccessEvent(activeSession!, testEventId)).toBe(true);
      expect(canAccessEvent(activeSession!, "non-existent-event-id")).toBe(false);

      // 3. Owner revokes family member access
      const revokedSuccess = await revokeFamilyMemberAccess(familyUserId, ownerUserId);
      expect(revokedSuccess).toBe(true);

      // 4. Invariant AT04: Next request with the same token immediately returns null
      const postRevocationSession = await getCurrentSession(reqHeaders);
      expect(postRevocationSession).toBeNull();

      // Session must be completely deleted from DB
      expect(mockDb.sessions.size).toBe(0);

      // Event accesses must be cleared
      const remainingAccess = mockDb.memberEventAccess.filter((a) => a.userId === familyUserId);
      expect(remainingAccess.length).toBe(0);

      // Audit log must record the revocation
      const revokeAudit = mockDb.auditLogs.find(
        (l) => l.action === "REVOKE_MEMBER_ACCESS"
      );
      expect(revokeAudit).toBeDefined();
    });

    it.each(["session_token", "better-auth.session_token", "__Secure-session_token", "__Secure-better-auth.session_token"])("validates signed %s cookies in routes and Server Components", async (cookieName) => {
      const familyUserId = crypto.randomUUID();
      mockDb.users.set(familyUserId, {
        id: familyUserId,
        name: "Cookie User",
        email: "cookie.user@wedding.local",
        emailVerified: true,
        image: null,
        role: "family_view",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const sessionToken = `cookie_token_${crypto.randomBytes(16).toString("hex")}`;
      const sessionId = crypto.randomUUID();
      mockDb.sessions.set(sessionId, {
        id: sessionId,
        userId: familyUserId,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      });

      const reqHeaders = new Headers();
      reqHeaders.set("cookie", `other=value; ${cookieName}=${signedSessionCookie(sessionToken)}`);

      const session = await getCurrentSession(reqHeaders);
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe(familyUserId);

      // The dashboard layout reads Next.js request headers without an explicit Request.
      vi.mocked(nextHeaders).mockResolvedValue(reqHeaders as Awaited<ReturnType<typeof nextHeaders>>);
      expect((await getCurrentSession())?.user.id).toBe(familyUserId);

      for (const value of [
        sessionToken, // Unsigned cookie
        signedSessionCookie(sessionToken, "wrong-secret"),
        signedSessionCookie(`${sessionToken}-tampered`),
        "%invalid-encoding",
      ]) {
        reqHeaders.set("cookie", `${cookieName}=${value}`);
        expect(await getCurrentSession(reqHeaders)).toBeNull();
      }

      reqHeaders.set("cookie", `${cookieName}=${signedSessionCookie(sessionToken)}`);
      mockDb.sessions.get(sessionId)!.expiresAt = new Date(Date.now() - 1000);
      expect(await getCurrentSession(reqHeaders)).toBeNull();
      mockDb.sessions.get(sessionId)!.expiresAt = new Date(Date.now() + 86400000);
      mockDb.sessions.delete(sessionId);
      expect(await getCurrentSession(reqHeaders)).toBeNull();
    });

    it("returns null when session token is expired", async () => {
      const expiredUserId = crypto.randomUUID();
      mockDb.users.set(expiredUserId, {
        id: expiredUserId,
        name: "Expired User",
        email: "expired@wedding.local",
        emailVerified: true,
        image: null,
        role: "family_view",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const expiredToken = `expired_token_${crypto.randomBytes(16).toString("hex")}`;
      mockDb.sessions.set("expired-session-id", {
        id: "expired-session-id",
        userId: expiredUserId,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 1000), // Expired in past
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      });

      const reqHeaders = new Headers();
      reqHeaders.set("authorization", `Bearer ${expiredToken}`);

      const session = await getCurrentSession(reqHeaders);
      expect(session).toBeNull();
    });

    it("throws unauthorized error via requireAuthenticatedSession when not logged in", async () => {
      const emptyHeaders = new Headers();
      await expect(
        requireAuthenticatedSession(emptyHeaders)
      ).rejects.toThrow("UNAUTHORIZED: Active session required.");
    });

    it("does not mistake a database failure for an unauthenticated user", async () => {
      const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        vi.mocked(pool.query).mockRejectedValueOnce(new Error('Connection timeout'));
        const request = new Headers({ authorization: 'Bearer existing-session' });
        await expect(getCurrentSession(request)).rejects.toBeInstanceOf(SessionStoreUnavailableError);
        expect(logger.mock.calls.flat().join(' ')).not.toContain('existing-session');
      } finally { logger.mockRestore(); }
    });

    it("throws forbidden error via requireOwnerSession when caller is family_view", async () => {
      const familyUserId = crypto.randomUUID();
      mockDb.users.set(familyUserId, {
        id: familyUserId,
        name: "Family User",
        email: testFamilyEmail,
        emailVerified: true,
        image: null,
        role: "family_view",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const token = "family_token_123";
      mockDb.sessions.set("family-sess-id", {
        id: "family-sess-id",
        userId: familyUserId,
        token,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      });

      const reqHeaders = new Headers();
      reqHeaders.set("authorization", `Bearer ${token}`);

      await expect(
        requireOwnerSession(reqHeaders)
      ).rejects.toThrow("FORBIDDEN: Owner role required for this action.");
    });
  });

  // ============================================================================
  // AT50: Family View Invite System & Replay Protection
  // ============================================================================
  describe("AT50: Family View Invite System & Replay Protection", () => {
    it("executes full invite lifecycle with hash-at-rest, email verification, and replay rejection", async () => {
      // 1. Owner creates single-use family invite
      const inviteResult = await createFamilyInvite(
        { email: testFamilyEmail, allowedEventIds: [testEventId] },
        ownerUserId
      );

      expect(inviteResult.rawToken).toBeDefined();
      expect(inviteResult.rawToken.length).toBe(64); // 32 bytes hex = 64 characters
      expect(inviteResult.inviteUrl).toContain(inviteResult.rawToken);
      expect(inviteResult.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Assert token is hashed at rest: rawToken must NEVER equal tokenHash in DB
      const storedInvite = mockDb.memberInvites.get(inviteResult.inviteId);
      expect(storedInvite).toBeDefined();
      expect(storedInvite?.tokenHash).not.toBe(inviteResult.rawToken);

      const expectedHash = crypto
        .createHash("sha256")
        .update(inviteResult.rawToken)
        .digest("hex");
      expect(storedInvite?.tokenHash).toBe(expectedHash);
      expect(storedInvite?.status).toBe("pending");

      // Verify gatekeeper now allows this invited email to proceed (AT50)
      const eligibility = await validateLoginEligibility(testFamilyEmail);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.role).toBe("family_view");

      // 2. Reject redemption when authenticated with mismatched email (AT50)
      const wrongUser = {
        id: crypto.randomUUID(),
        email: "impostor@wedding.local",
      };

      await expect(
        redeemFamilyInvite(inviteResult.rawToken, wrongUser)
      ).rejects.toThrow("EMAIL_MISMATCH");

      // 3. Successful redemption by matching user
      const familyUserId = crypto.randomUUID();
      mockDb.users.set(familyUserId, {
        id: familyUserId,
        name: "Bác Ba",
        email: testFamilyEmail,
        emailVerified: true,
        image: null,
        role: "family_view",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const redeemResult = await redeemFamilyInvite(inviteResult.rawToken, {
        id: familyUserId,
        email: testFamilyEmail,
      });

      expect(redeemResult.success).toBe(true);
      expect(redeemResult.role).toBe("family_view");
      expect(redeemResult.allowedEventIds).toContain(testEventId);

      // Verify invite status is updated to accepted
      expect(storedInvite?.status).toBe("accepted");

      // Verify member_event_access row was created
      const accessRows = mockDb.memberEventAccess.filter((a) => a.userId === familyUserId);
      expect(accessRows.length).toBe(1);
      expect(accessRows[0].eventId).toBe(testEventId);

      // 4. Replay Attack Protection (AT50): Attempt second redemption with identical token
      await expect(
        redeemFamilyInvite(inviteResult.rawToken, {
          id: familyUserId,
          email: testFamilyEmail,
        })
      ).rejects.toThrow("INVITE_ALREADY_USED");
    });

    it("rejects redemption of expired invitation links (AT50)", async () => {
      const inviteResult = await createFamilyInvite(
        { email: testFamilyEmail, allowedEventIds: [testEventId] },
        ownerUserId
      );

      // Fast-forward expiration into the past
      const storedInvite = mockDb.memberInvites.get(inviteResult.inviteId)!;
      storedInvite.expiresAt = new Date(Date.now() - 1000);

      const familyUserId = crypto.randomUUID();
      await expect(
        redeemFamilyInvite(inviteResult.rawToken, {
          id: familyUserId,
          email: testFamilyEmail,
        })
      ).rejects.toThrow("INVITE_EXPIRED");
    });

    it("rejects redemption of revoked invitation links (AT50)", async () => {
      const inviteResult = await createFamilyInvite(
        { email: testFamilyEmail, allowedEventIds: [testEventId] },
        ownerUserId
      );

      // Owner revokes invite
      const revokeOk = await revokeFamilyInvite(inviteResult.inviteId, ownerUserId);
      expect(revokeOk).toBe(true);

      const familyUserId = crypto.randomUUID();
      await expect(
        redeemFamilyInvite(inviteResult.rawToken, {
          id: familyUserId,
          email: testFamilyEmail,
        })
      ).rejects.toThrow("INVITE_REVOKED");
    });

    it("guarantees that redeeming a family invite never demotes an existing owner to family_view", async () => {
      const ownerEmail = "owner.redeem.test@wedding.local";
      const ownerId = crypto.randomUUID();

      // Seed user as owner
      mockDb.users.set(ownerId, {
        id: ownerId,
        name: "Chủ sở hữu",
        email: ownerEmail,
        emailVerified: true,
        image: null,
        role: "owner",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create invite for owner email
      const inviteResult = await createFamilyInvite(
        { email: ownerEmail, allowedEventIds: [testEventId] },
        ownerUserId
      );

      // Owner redeems invite
      const res = await redeemFamilyInvite(inviteResult.rawToken, {
        id: ownerId,
        email: ownerEmail,
      });

      expect(res.success).toBe(true);

      // Verify that user role remains 'owner' and was NOT downgraded to 'family_view'
      const updatedUser = mockDb.users.get(ownerId);
      expect(updatedUser?.role).toBe("owner");
    });
  });
});
