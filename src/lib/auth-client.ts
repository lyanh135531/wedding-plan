import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    // Without an explicit override, Better Auth uses the browser's current origin.
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
})
