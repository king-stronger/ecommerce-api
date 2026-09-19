import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../db/db.js";
import type { Environment } from "../env.js"
import env from "../env.js"

type AuthEnv = Pick<Environment, "DATABASE_URL" | "BETTER_AUTH_URL" | "BETTER_AUTH_SECRET">

export function createAuth(env: AuthEnv){
    return betterAuth({
        baseURL: env.BETTER_AUTH_URL,
        database: drizzleAdapter(createDb(env), {
            provider: "pg",
        }),
        emailAndPassword: {
            enabled: true
        }
    });
}

export const auth = createAuth(env)

export type Auth = ReturnType<typeof createAuth>