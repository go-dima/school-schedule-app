import { afterEach, describe, expect, it, vi } from "vitest";

// `env` and its derived helpers are computed once at module load
// (`export const env = getEnvironmentConfig()`), so exercising both
// VITE_DEV_MODE values requires resetting the module registry and
// re-importing between cases.
async function loadEnvModule() {
  vi.resetModules();
  return import("./env");
}

describe("env / scope provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats VITE_DEV_MODE=true as non-production, allowing both scopes", async () => {
    vi.stubEnv("VITE_DEV_MODE", "true");

    const { env, getAllowedScopes, isTestScopeEnabled } = await loadEnvModule();

    expect(env.isDev).toBe(true);
    expect(env.isProduction).toBe(false);
    expect(getAllowedScopes()).toEqual(["prod", "test"]);
    expect(isTestScopeEnabled()).toBe(true);
  });

  it("treats VITE_DEV_MODE unset/false as production, restricting to prod scope only", async () => {
    vi.stubEnv("VITE_DEV_MODE", "false");

    const { env, getAllowedScopes, isTestScopeEnabled } = await loadEnvModule();

    expect(env.isDev).toBe(false);
    expect(env.isProduction).toBe(true);
    expect(getAllowedScopes()).toEqual(["prod"]);
    expect(isTestScopeEnabled()).toBe(false);
  });
});
