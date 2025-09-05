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

function validateEnvVars(): void {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
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
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    appTitle:
      import.meta.env.VITE_APP_TITLE || "School Schedule Management System",
    isDev:
      import.meta.env.VITE_DEV_MODE === "true" ||
      import.meta.env.MODE === "development",
  };
}

// Export individual values for convenience
export const env = getEnvironmentConfig();

// Type declarations for import.meta.env
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_APP_TITLE?: string;
    readonly VITE_DEV_MODE?: string;
    readonly MODE?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
