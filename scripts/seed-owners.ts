import { z } from "zod";
import crypto from "node:crypto";
import { pool } from "../src/db/client";
import * as schema from "../src/db/schema";
import { users, auditLogs } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

const emailSchema = z
  .string()
  .email("Invalid email format")
  .trim()
  .toLowerCase();

export interface SeedOwnersResult {
  owners: {
    email: string;
    userId: string;
    status: "created" | "already_owner" | "updated_to_owner";
  }[];
}

/**
 * Idempotently creates or updates two distinct Owner records in the database (AT49).
 *
 * CRUCIAL SECURITY INVARIANTS:
 * 1. Never creates passwords (Google OAuth 2.0 only).
 * 2. Never creates active sessions.
 * 3. Never assigns Owner role to unverified strangers (AT02, AT49).
 * 4. 100% Idempotent: safe to run multiple times without duplicating or corrupting data.
 */
export async function seedOwners(
  email1: string,
  email2: string,
  options: { closePool?: boolean } = {}
): Promise<SeedOwnersResult> {
  const parsed1 = emailSchema.safeParse(email1);
  const parsed2 = emailSchema.safeParse(email2);

  if (!parsed1.success) {
    throw new Error(`Invalid owner email 1 '${email1}': ${parsed1.error.message}`);
  }
  if (!parsed2.success) {
    throw new Error(`Invalid owner email 2 '${email2}': ${parsed2.error.message}`);
  }

  const normalized1 = parsed1.data;
  const normalized2 = parsed2.data;

  if (normalized1 === normalized2) {
    throw new Error("The two owner email addresses must be distinct.");
  }

  const targetEmails = [normalized1, normalized2];
  const results: SeedOwnersResult["owners"] = [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    const txDb = drizzle(client, { schema });

    for (const email of targetEmails) {
      const [existingUser] = await txDb
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        if (existingUser.role !== "owner") {
          await txDb
            .update(users)
            .set({ role: "owner", updatedAt: new Date() })
            .where(eq(users.id, existingUser.id));

          await txDb.insert(auditLogs).values({
            id: crypto.randomUUID(),
            userId: "system",
            action: "SYSTEM_SEED_OWNER_UPDATE",
            entityType: "USER_ROLE",
            entityId: crypto.randomUUID(),
            afterState: { email, role: "owner", userId: existingUser.id },
            createdAt: new Date(),
          });

          results.push({
            email,
            userId: existingUser.id,
            status: "updated_to_owner",
          });
        } else {
          results.push({
            email,
            userId: existingUser.id,
            status: "already_owner",
          });
        }
      } else {
        const newUserId = crypto.randomUUID();
        await txDb.insert(users).values({
          id: newUserId,
          name: "Chủ sở hữu",
          email: email,
          emailVerified: false, // Will be verified upon first successful Google OAuth login
          role: "owner",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await txDb.insert(auditLogs).values({
          id: crypto.randomUUID(),
          userId: "system",
          action: "SYSTEM_SEED_OWNER",
          entityType: "USER_ROLE",
          entityId: crypto.randomUUID(),
          afterState: { email, role: "owner", userId: newUserId },
          createdAt: new Date(),
        });

        results.push({
          email,
          userId: newUserId,
          status: "created",
        });
      }
    }

    await client.query("COMMIT;");
    return { owners: results };
  } catch (error) {
    await client.query("ROLLBACK;");
    throw error;
  } finally {
    client.release();
    if (options.closePool) {
      await pool.end();
    }
  }
}

// -------------------------------------------------------------
// CLI Execution Entry Point
// -------------------------------------------------------------
const isDirectRun =
  process.argv[1] &&
  (/seed-owners(\.[mc]?[jt]s)?$/i.test(process.argv[1]) ||
    process.argv[1].endsWith("seed-owners.ts") ||
    process.argv[1].endsWith("seed-owners.js"));

if (isDirectRun) {
  const args = process.argv.slice(2);
  const email1 = args[0] || process.env.SEED_OWNER_EMAIL_1;
  const email2 = args[1] || process.env.SEED_OWNER_EMAIL_2;

  if (!email1 || !email2) {
    console.error("Usage: pnpm tsx scripts/seed-owners.ts <groom_email> <bride_email>");
    console.error("Example: pnpm tsx scripts/seed-owners.ts groom@example.com bride@example.com");
    process.exit(1);
  }

  seedOwners(email1, email2, { closePool: true })
    .then((res) => {
      console.log("[Seed Owners] Successfully configured 2 owners:");
      for (const o of res.owners) {
        console.log(`  - ${o.email} (${o.status}, ID: ${o.userId})`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seed Owners Error]:", err.message || err);
      process.exit(1);
    });
}
