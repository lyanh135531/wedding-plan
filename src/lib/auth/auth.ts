import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db/client";
import { users, sessions, accounts, verifications, memberInvites } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * Validates whether an email is eligible for initial Google OAuth sign-in.
 * Enforces AT02 and AT49: Only pre-seeded owners or users with a valid pending family invite
 * are permitted to create an account in the wedding management platform.
 */
export async function validateLoginEligibility(email: string): Promise<{
  eligible: boolean;
  role?: "owner" | "family_view";
  reason?: string;
}> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check if email was pre-seeded in users table (Owner workflow - AT49)
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser) {
    return {
      eligible: true,
      role: existingUser.role,
    };
  }

  // 2. Check if email has a valid pending invite in member_invites (Family workflow - AT50)
  const [pendingInvite] = await db
    .select()
    .from(memberInvites)
    .where(
      and(
        eq(memberInvites.email, normalizedEmail),
        eq(memberInvites.status, "pending"),
        gt(memberInvites.expiresAt, new Date())
      )
    )
    .limit(1);

  if (pendingInvite) {
    return {
      eligible: true,
      role: "family_view",
    };
  }

  // 3. Uninvited stranger detected (AT02, AT49)
  return {
    eligible: false,
    reason: "STRANGER_BLOCKED: Email has neither pre-seeded owner rights nor a pending family invitation.",
  };
}

const authSecret = process.env.BETTER_AUTH_SECRET;
const isBuildTime =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export" ||
  process.env.npm_lifecycle_event === "build";

if (process.env.NODE_ENV === "production" && !isBuildTime && (!authSecret || authSecret.length < 32)) {
  throw new Error(
    "FATAL: BETTER_AUTH_SECRET must be set to a secure string with at least 32 characters in production."
  );
}

/**
 * Better Auth Server Configuration with Google OAuth 2.0 Provider,
 * PostgreSQL persistence via Drizzle ORM, 7-day session duration,
 * secure cookie flags, and database gatekeeper hook.
 */
export const auth = betterAuth({
  // 1. Drizzle ORM adapter mapping existing M1 PostgreSQL schema
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users,
      sessions,
      accounts,
      verifications,
    },
    usePlural: true,
  }),

  // 2. Secret & Base URL
  secret: authSecret || "wedding_platform_auth_secret_minimum_32_chars_default",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

  // 3. Role field extension (immutable from client payload)
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "family_view",
        input: false, // Security: clients cannot supply or override role via payload
      },
    },
  },

  // 4. Session Lifetime & Persistence (PLAN §5.3, §21.1)
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds (604,800s)
    updateAge: 24 * 60 * 60,     // 24 hours sliding refresh window
    cookieCache: {
      enabled: false,            // Strictly disabled: always query live DB to enforce AT04 immediate revocation
    },
  },

  // 5. Google OAuth 2.0 Provider
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectURI:
        process.env.GOOGLE_REDIRECT_URI ||
        `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/api/auth/callback/google`,
    },
  },

  // 6. Trusted Account Linking
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"], // Strictly trusted Google provider only
    },
  },

  // 7. Cookie Security & Flags (PLAN §21.4)
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Required for OAuth redirect navigation
      path: "/",
    },
    cookies: {
      session_token: {
        name: "session_token",
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        },
      },
    },
  },

  // 8. Gatekeeper Database Hook: Reject Uninvited Strangers (AT02, AT49)
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const eligibility = await validateLoginEligibility(user.email);

          if (!eligibility.eligible) {
            console.warn(`[AUTH GATEKEEPER] Blocked uninvited email sign-in attempt: ${user.email}`);
            return false; // Aborts user creation in Better Auth
          }

          return {
            data: {
              ...user,
              role: eligibility.role || "family_view",
            },
          };
        },
      },
    },
  },
});

export type Auth = typeof auth;
