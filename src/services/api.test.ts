import { describe, expect, it, vi } from "vitest";

type AuthChangeHandler = (event: string, session: any) => any;

const authCallbacks: AuthChangeHandler[] = [];

vi.mock("./supabase", () => {
  return {
    supabase: {
      auth: {
        onAuthStateChange: vi.fn((cb: AuthChangeHandler) => {
          authCallbacks.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
      // Simulates the users-lookup query hanging forever, which is what
      // happens when supabase-js's internal auth lock deadlocks.
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn(() => new Promise(() => {})),
      })),
    },
  };
});

// Import after the mock so `api.ts` picks up the mocked `./supabase` module.
const { authApi } = await import("./api");

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    ),
  ]);
}

describe("authApi.onAuthStateChange", () => {
  it("delivers the signed-in user to the callback without waiting on the profile lookup", async () => {
    const received: any[] = [];
    authApi.onAuthStateChange(user => received.push(user));

    const handler = authCallbacks[authCallbacks.length - 1];
    const user = { id: "user-1", email: "a@b.com" };

    await withTimeout(Promise.resolve(handler("SIGNED_IN", { user })), 50);

    expect(received).toEqual([user]);
  });
});
