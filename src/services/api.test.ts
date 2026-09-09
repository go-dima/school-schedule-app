import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AuthChangeHandler = (event: string, session: any) => any;

const authCallbacks: AuthChangeHandler[] = [];

// Fixture data resolved by the chainable `from(...)` mock below when it is
// awaited. Tests that care about the resolved rows set this before invoking
// the code under test; it defaults to an empty, error-free result so tests
// that never await the chain (e.g. the getUser-hang test) are unaffected.
let mockFromResult: { data: any; error: any } = { data: [], error: null };

// Fixture data resolved by the `rpc(...)` mock below when it is awaited.
// Tests that care about the resolved rows set this before invoking the code
// under test; it defaults to an empty, error-free result so tests that never
// call an rpc-backed function are unaffected.
let mockRpcResult: { data: any; error: any } = { data: [], error: null };

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
      rpc: vi.fn(() => Promise.resolve(mockRpcResult)),
      // Simulates the users-lookup query hanging forever, which is what
      // happens when supabase-js's internal auth lock deadlocks.
      from: vi.fn(() => {
        const chain: any = {};
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.not = vi.fn(() => chain);
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn(() => new Promise(() => {}));
        // Makes the chain awaitable: `await supabase.from(...).select(...)...`
        // resolves to whatever `mockFromResult` currently holds.
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve(mockFromResult).then(resolve, reject);
        return chain;
      }),
    },
  };
});

// Import after the mock so `api.ts` picks up the mocked `./supabase` module.
const { authApi, scheduleApi } = await import("./api");

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

describe("scheduleApi.getClassEnrolledChildren", () => {
  afterEach(() => {
    mockRpcResult = { data: [], error: null };
  });

  it("maps snake_case rows to camelCase children and sorts by grade then Hebrew name", async () => {
    mockRpcResult = {
      data: [
        {
          id: "child-b",
          first_name: "דוד",
          last_name: "לוי",
          grade: 1,
          group_number: 2,
          track_number: null,
          scope: "prod",
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-02T00:00:00.000Z",
        },
        {
          id: "child-a",
          first_name: "אביגיל",
          last_name: "כהן",
          grade: 2,
          group_number: null,
          track_number: 1,
          scope: "prod",
          created_at: "2024-01-03T00:00:00.000Z",
          updated_at: "2024-01-04T00:00:00.000Z",
        },
        {
          id: "child-c",
          first_name: "אבי",
          last_name: "אברהם",
          grade: 1,
          group_number: 1,
          track_number: null,
          scope: "prod",
          created_at: "2024-01-05T00:00:00.000Z",
          updated_at: "2024-01-06T00:00:00.000Z",
        },
      ],
      error: null,
    };

    const result = await scheduleApi.getClassEnrolledChildren("class-1");

    expect(result).toEqual([
      {
        id: "child-c",
        firstName: "אבי",
        lastName: "אברהם",
        grade: 1,
        groupNumber: 1,
        trackNumber: null,
        scope: "prod",
        createdAt: "2024-01-05T00:00:00.000Z",
        updatedAt: "2024-01-06T00:00:00.000Z",
      },
      {
        id: "child-b",
        firstName: "דוד",
        lastName: "לוי",
        grade: 1,
        groupNumber: 2,
        trackNumber: null,
        scope: "prod",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      },
      {
        id: "child-a",
        firstName: "אביגיל",
        lastName: "כהן",
        grade: 2,
        groupNumber: null,
        trackNumber: 1,
        scope: "prod",
        createdAt: "2024-01-03T00:00:00.000Z",
        updatedAt: "2024-01-04T00:00:00.000Z",
      },
    ]);
  });

  it("returns an empty array without throwing when the RPC resolves with null data", async () => {
    mockRpcResult = { data: null, error: null };

    const result = await scheduleApi.getClassEnrolledChildren("class-1");

    expect(result).toEqual([]);
  });

  it("throws an ApiError when the query fails", async () => {
    mockRpcResult = { data: null, error: { message: "boom" } };

    await expect(
      scheduleApi.getClassEnrolledChildren("class-1")
    ).rejects.toThrow("boom");
  });
});
