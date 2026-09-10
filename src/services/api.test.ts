import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
        // Simulates a stuck lock-guarded call, which is what happens when
        // supabase-js's internal auth lock deadlocks.
        getUser: vi.fn(() => new Promise(() => {})),
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
const { authApi, scheduleApi, childrenApi } = await import("./api");
const { supabase } = await import("./supabase");

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

describe("scheduleApi.selectSchedule (childId target)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects instead of hanging forever when supabase.auth.getUser never resolves", async () => {
    const call = scheduleApi.selectSchedule(
      { childId: "child-1" },
      "class-1",
      "draft"
    );
    // Prevent an unhandled-rejection warning if the timeout wins the race
    // before this assertion attaches its own handler.
    call.catch(() => {});

    await vi.advanceTimersByTimeAsync(10000);

    await expect(call).rejects.toThrow();
  });
});

describe("childrenApi.deleteChild", () => {
  const originalFrom = supabase.from;

  afterEach(() => {
    supabase.from = originalFrom;
  });

  it("throws instead of reporting false success when RLS silently filters the delete to 0 rows", async () => {
    const builder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    supabase.from = vi.fn().mockReturnValue(builder) as typeof supabase.from;

    await expect(childrenApi.deleteChild("child-1")).rejects.toThrow(
      /no matching student found or insufficient permissions/
    );
  });

  it("resolves when the row was actually deleted", async () => {
    const builder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi
        .fn()
        .mockResolvedValue({ data: [{ id: "child-1" }], error: null }),
    };
    supabase.from = vi.fn().mockReturnValue(builder) as typeof supabase.from;

    await expect(childrenApi.deleteChild("child-1")).resolves.toBeUndefined();
  });
});
