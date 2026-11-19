import { db, pool, withTransactionScopedContext } from "@/db/client";
import { users, sessions, memberEventAccess } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { constantTimeEqual, makeSignature } from "better-auth/crypto";
import { auth } from "./auth";

export type UserRole = "owner" | "family_view";

export class SessionStoreUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() { super('Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại sau.'); }
}

export interface UserSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: "owner" | "family_view";
    image?: string | null;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
  };
  role: "owner" | "family_view";
  allowedEventIds: string[];
}

/**
 * Verifies Better Auth's signed cookie and returns only the database token.
 * Supports both standard 'session_token' and Better Auth 'better-auth.session_token'.
 */
async function extractTokenFromCookieHeader(cookieHeader: string | null): Promise<string | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    /(?:^|;\s*)(?:__Secure-)?(?:session_token|better-auth\.session_token)=([^;]+)/
  );
  if (!match) return null;

  try {
    const value = decodeURIComponent(match[1].trim());
    const separator = value.lastIndexOf(".");
    if (separator < 1) return null;
    const token = value.slice(0, separator);
    const signature = value.slice(separator + 1);
    const { secret } = await auth.$context;
    const expectedSignature = await makeSignature(token, secret);
    return constantTimeEqual(signature, expectedSignature) ? token : null;
  } catch {
    // Malformed or invalid cookies must never authenticate a request.
    return null;
  }
}

/**
 * Extracts and validates the active session against PostgreSQL.
 *
 * CRUCIAL SECURITY INVARIANT (AT04):
 * ALWAYS queries the live database directly on every request to verify user role,
 * account validity, and event assignments. Never trusts or caches client-side role claims,
 * ensuring immediate revocation effect.
 *
 * @param req - Optional Request or Headers object (useful in route handlers, middleware, and tests)
 */
export async function getCurrentSession(req?: Request | Headers): Promise<UserSession | null> {
  try {
    let token: string | null = null;

    let headersObj = req instanceof Request ? req.headers : req;
    if (!headersObj) {
      // Use the same cookie verification in Server Components and route handlers.
      try {
        const { headers } = await import("next/headers");
        headersObj = await headers();
      } catch {
        // Outside Next.js request context (e.g. CLI or headless test)
      }
    }

    // Bearer tokens are raw credentials; browser cookies are signed by Better Auth.
    const authHeader = headersObj?.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    if (!token) {
      token = await extractTokenFromCookieHeader(headersObj?.get("cookie") ?? null);
    }

    if (!token) {
      return null;
    }

    // 4. Query PostgreSQL directly: Join sessions with users (AT04 Live DB Invariant)
    const now = new Date();
    const [record] = await db
      .select({
        sessionId: sessions.id,
        sessionUserId: sessions.userId,
        sessionExpiresAt: sessions.expiresAt,
        sessionToken: sessions.token,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        userRole: users.role,
        userImage: users.image,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
      .limit(1);

    if (!record) {
      return null;
    }

    // 5. Verify user role validity
    if (record.userRole !== "owner" && record.userRole !== "family_view") {
      return null;
    }

    // 6. Query member_event_access to populate allowedEventIds for family users
    let allowedEventIds: string[] = [];
    if (record.userRole === "family_view") {
      const accessRows = await withTransactionScopedContext(
        record.userId,
        'family_view',
        async (_client, scopedDb) => scopedDb
          .select({ eventId: memberEventAccess.eventId })
          .from(memberEventAccess)
          .where(eq(memberEventAccess.userId, record.userId))
      );

      allowedEventIds = accessRows.map((r) => r.eventId);
    }

    return {
      user: {
        id: record.userId,
        name: record.userName,
        email: record.userEmail,
        role: record.userRole,
        image: record.userImage,
      },
      session: {
        id: record.sessionId,
        userId: record.sessionUserId,
        expiresAt: record.sessionExpiresAt,
        token: record.sessionToken,
      },
      role: record.userRole,
      allowedEventIds,
    };
  } catch (error) {
    // A database outage is not an invalid session. Do not redirect a logged-in
    // user to login, or put session tokens from failed SQL queries into logs.
    console.error("[getCurrentSession Error]: Session storage unavailable.");
    throw new SessionStoreUnavailableError();
  }
}

/**
 * Revokes a family member's access immediately (AT04).
 * Purges active sessions, removes event assignments, revokes invitations, and writes audit log.
 *
 * @param userId - Target user identifier
 * @param ownerUserId - ID of the owner requesting the revocation (defaults to 'system')
 */
export async function revokeFamilyMemberAccess(
  userId: string,
  ownerUserId: string = "system"
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 1. Delete all active sessions immediately (AT04)
    await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);

    // 2. Remove all assigned event permissions
    await client.query("DELETE FROM member_event_access WHERE user_id = $1", [userId]);

    // 3. Mark pending invites for this user's email as revoked
    await client.query(
      `UPDATE member_invites
       SET status = 'revoked'
       WHERE email IN (SELECT email FROM users WHERE id = $1)`,
      [userId]
    );

    // 4. Record audit log
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, after_state, created_at)
       VALUES (gen_random_uuid(), $1, 'REVOKE_MEMBER_ACCESS', 'USER_ROLE', gen_random_uuid(), $2, clock_timestamp())`,
      [ownerUserId, JSON.stringify({ revokedUserId: userId })]
    );

    await client.query("COMMIT;");
    return true;
  } catch (error) {
    await client.query("ROLLBACK;");
    console.error("[revokeFamilyMemberAccess Error]:", error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Requires an authenticated user session; throws Error if missing or expired.
 */
export async function requireAuthenticatedSession(req?: Request | Headers): Promise<UserSession> {
  const session = await getCurrentSession(req);
  if (!session) {
    throw new Error("UNAUTHORIZED: Active session required.");
  }
  return session;
}

/**
 * Requires an Owner session; throws Error if not an Owner.
 */
export async function requireOwnerSession(req?: Request | Headers): Promise<UserSession> {
  const session = await requireAuthenticatedSession(req);
  if (session.role !== "owner") {
    throw new Error("FORBIDDEN: Owner role required for this action.");
  }
  return session;
}

/**
 * Checks if a session has permission to access a specific wedding event.
 * Owners have access to all events. Family view users are checked against allowedEventIds.
 */
export function canAccessEvent(session: UserSession, eventId: string): boolean {
  if (session.role === "owner") {
    return true;
  }
  if (session.role === "family_view") {
    return session.allowedEventIds.includes(eventId);
  }
  return false;
}
