/**
 * Environment variables utility
 * Provides type-safe access to environment variables
 */

interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appTitle: string;
  isDev: boolean;
}

const requiredEnvVars = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

// import.meta.env is populated by Vite (browser/dev-server/build). Scripts run
// directly under Node (e.g. via tsx) don't go through Vite, so fall back to
// process.env there.
/* eslint-disable no-undef -- ImportMetaEnv is declared via `declare global`
   below; core no-undef doesn't see ambient TS types in type positions, tsc does. */
const runtimeEnv: Partial<Record<keyof ImportMetaEnv, string>> =
  import.meta.env ??
  (process.env as Partial<Record<keyof ImportMetaEnv, string>>);
/* eslint-enable no-undef */

function validateEnvVars(): void {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!runtimeEnv[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please create a .env.local file with the required variables. " +
        "See .env.example for reference."
    );
  }
}

export function getEnvironmentConfig(): EnvironmentConfig {
  validateEnvVars();

  return {
    supabaseUrl: runtimeEnv.VITE_SUPABASE_URL!,
    supabaseAnonKey: runtimeEnv.VITE_SUPABASE_ANON_KEY!,
    appTitle: runtimeEnv.VITE_APP_TITLE || "School Schedule Management System",
    isDev:
      runtimeEnv.VITE_DEV_MODE === "true" || runtimeEnv.MODE === "development",
  };
}

// Export individual values for convenience
export const env = getEnvironmentConfig();

// Type declarations for import.meta.env (merges onto vite/client's
// ImportMetaEnv/ImportMeta, declared via the vite-env.d.ts reference)
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_APP_TITLE?: string;
    readonly VITE_DEV_MODE?: string;
  }
}
