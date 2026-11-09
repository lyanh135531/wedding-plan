import crypto from "node:crypto";
import { z } from "zod";
import { db, pool } from "@/db/client";
import { memberInvites, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const createInviteSchema = z.object({
  email: z.string().email("Invalid email format").trim().toLowerCase(),
  allowedEventIds: z.array(z.string().uuid("Invalid event UUID format")),
  invitedByUserId: z.string().min(1, "invitedByUserId is required").optional(),
});

export interface CreateFamilyInviteParams {
  email: string;
  allowedEventIds: string[];
  invitedByUserId?: string;
  baseUrl?: string;
}

export interface CreateFamilyInviteResult {
  inviteId: string;
  rawToken: string;
  inviteUrl: string;
  expiresAt: Date;
  email: string;
}

export interface RedeemInviteInput {
  rawToken: string;
  currentUserId?: string;
  currentUserEmail?: string;
  id?: string;
  email?: string;
}

export interface RedeemInviteResult {
  success: boolean;
  role: "family_view";
  allowedEventIds: string[];
}

export class InviteError extends Error {
  constructor(public code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = "InviteError";
  }
}

/**
 * Creates a single-use Family View invite link (AT50).
 * Generates a 256-bit cryptographically secure random token and stores ONLY its SHA-256 hash in DB.
 * The raw token is returned once for URL generation and is never persisted in plain text.
 */
export async function createFamilyInvite(
  params: CreateFamilyInviteParams,
  ownerUserIdArg?: string,
  baseUrlArg?: string
): Promise<CreateFamilyInviteResult> {
  const validated = createInviteSchema.parse(params);
  const invitedByUserId = ownerUserIdArg || params.invitedByUserId;

  if (!invitedByUserId) {
    throw new InviteError("MISSING_INVITER", "invitedByUserId must be provided.");
  }

  const baseUrl =
    baseUrlArg ||
    params.baseUrl ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000";

  // 1. Generate 32 bytes high-entropy random token
  const rawToken = crypto.randomBytes(32).toString("hex");

  // 2. Compute SHA-256 hash for secure storage at rest (AT50)
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  // 3. Strict 7-day expiration
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const inviteId = crypto.randomUUID();

  // 4. Insert into member_invites table
  await db.insert(memberInvites).values({
    id: inviteId,
    email: validated.email,
    tokenHash: tokenHash,
    role: "family_view",
    allowedEventIds: validated.allowedEventIds,
    expiresAt: expiresAt,
    invitedByUserId: invitedByUserId,
    status: "pending",
    createdAt: new Date(),
  });

  // 5. Insert audit log
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: invitedByUserId,
    action: "CREATE_MEMBER_INVITE",
    entityType: "MEMBER_INVITE",
    entityId: inviteId,
    afterState: {
      email: validated.email,
      allowedEventIds: validated.allowedEventIds,
      expiresAt: expiresAt.toISOString(),
    },
    createdAt: new Date(),
  });

  return {
    inviteId,
    rawToken,
    inviteUrl: `${baseUrl}/invite?token=${rawToken}`,
    expiresAt,
    email: validated.email,
  };
}

/**
 * Redeems a Family View invitation token atomically.
 * Enforces email matching, expiration, and single-use replay protection (AT50).
 *
 * Supports both signatures:
 * - redeemFamilyInvite(rawToken, currentUser)
 * - redeemFamilyInvite({ rawToken, currentUserId, currentUserEmail })
 */
export async function redeemFamilyInvite(
  rawTokenOrInput: string | RedeemInviteInput,
  currentUserArg?: { id: string; email: string }
): Promise<RedeemInviteResult> {
  let rawToken: string;
  let currentUserId: string;
  let currentUserEmail: string;

  if (typeof rawTokenOrInput === "string") {
    rawToken = rawTokenOrInput;
    if (!currentUserArg) {
      throw new InviteError("MISSING_USER", "currentUser must be provided when passing rawToken string.");
    }
    currentUserId = currentUserArg.id;
    currentUserEmail = currentUserArg.email;
  } else {
    rawToken = rawTokenOrInput.rawToken;
    currentUserId = (rawTokenOrInput.currentUserId || rawTokenOrInput.id || currentUserArg?.id)!;
    currentUserEmail = (rawTokenOrInput.currentUserEmail || rawTokenOrInput.email || currentUserArg?.email)!;
  }

  if (!rawToken || rawToken.trim() === "") {
    throw new InviteError("INVALID_TOKEN", "Mã mời không hợp lệ.");
  }
  if (!currentUserId || !currentUserEmail) {
    throw new InviteError("MISSING_USER", "Thông tin người dùng hiện tại không hợp lệ.");
  }

  // 1. Compute SHA-256 hash of submitted raw token
  const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

  // 2. Query member_invites by token_hash
  const [invite] = await db
    .select()
    .from(memberInvites)
    .where(eq(memberInvites.tokenHash, tokenHash))
    .limit(1);

  if (!invite) {
    throw new InviteError("INVITE_NOT_FOUND", "Liên kết mời không tồn tại hoặc không hợp lệ.");
  }

  if (invite.status === "revoked") {
    throw new InviteError("INVITE_REVOKED", "Lời mời này đã bị chủ sở hữu thu hồi.");
  }

  if (invite.status === "accepted") {
    throw new InviteError("INVITE_ALREADY_USED", "Liên kết mời đã được sử dụng trước đó (chống replay).");
  }

  if (new Date() > invite.expiresAt) {
    throw new InviteError("INVITE_EXPIRED", "Lời mời này đã hết hạn sau 7 ngày.");
  }

  // 3. Exact Email Binding Verification (AT50)
  const normalizedUserEmail = currentUserEmail.trim().toLowerCase();
  const normalizedInviteEmail = invite.email.trim().toLowerCase();

  if (normalizedUserEmail !== normalizedInviteEmail) {
    throw new InviteError(
      "EMAIL_MISMATCH",
      `Email đăng nhập (${currentUserEmail}) không khớp với email được mời (${invite.email}). Vui lòng đăng nhập đúng tài khoản Google được mời.`
    );
  }

  // 4. Atomic Transaction: Concurrency-safe status update + role update + event permissions (AT50)
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // Concurrency-safe atomic check: WHERE id = $1 AND status = 'pending'
    const updateResult = await client.query(
      `UPDATE member_invites
       SET status = 'accepted'
       WHERE id = $1 AND status = 'pending'`,
      [invite.id]
    );

    if (updateResult.rowCount === 0) {
      throw new InviteError("INVITE_ALREADY_USED", "Lời mời vừa được sử dụng bởi một tiến trình khác.");
    }

    // Update user role to family_view only if user is not already an owner (prevent demotion)
    await client.query(
      `UPDATE users
       SET role = CASE WHEN role = 'owner' THEN 'owner' ELSE 'family_view' END,
           updated_at = clock_timestamp()
       WHERE id = $1`,
      [currentUserId]
    );

    // Insert permissions into member_event_access
    const allowedEventIds = invite.allowedEventIds || [];
    for (const eventId of allowedEventIds) {
      await client.query(
        `INSERT INTO member_event_access (id, user_id, event_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, clock_timestamp())
         ON CONFLICT (user_id, event_id) DO NOTHING`,
        [currentUserId, eventId]
      );
    }

    // Write audit log
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, after_state, created_at)
       VALUES (gen_random_uuid(), $1, 'MEMBER_INVITE_ACCEPTED', 'MEMBER_INVITE', $2, $3, clock_timestamp())`,
      [
        currentUserId,
        invite.id,
        JSON.stringify({ email: invite.email, allowedEventIds: invite.allowedEventIds }),
      ]
    );

    await client.query("COMMIT;");

    return {
      success: true,
      role: "family_view",
      allowedEventIds: invite.allowedEventIds,
    };
  } catch (error) {
    await client.query("ROLLBACK;");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Revokes a pending invitation (Owner only).
 */
export async function revokeFamilyInvite(
  inviteId: string,
  ownerUserId: string = "system"
): Promise<boolean> {
  const [invite] = await db
    .select()
    .from(memberInvites)
    .where(eq(memberInvites.id, inviteId))
    .limit(1);

  if (!invite) {
    return false;
  }

  await db
    .update(memberInvites)
    .set({ status: "revoked" })
    .where(eq(memberInvites.id, inviteId));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: ownerUserId,
    action: "REVOKE_MEMBER_INVITE",
    entityType: "MEMBER_INVITE",
    entityId: inviteId,
    afterState: { status: "revoked", email: invite.email },
    createdAt: new Date(),
  });

  return true;
}
