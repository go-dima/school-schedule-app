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

// Fixture data resolved by the `auth.signUp(...)` mock below when it is
// awaited. Defaults to an immediate session, error-free result.
let mockSignUpResult: { data: any; error: any } = {
  data: { user: { id: "user-1", email: "a@b.com" }, session: {} },
  error: null,
};

// Fixture data resolved by the chain's `.single()` mock below when it is
// awaited. Defaults to a "not found" shape (no existing profile row), since
// that's the common case exercised by the onAuthStateChange ensure-profile
// tests. Tests that care about an existing row set this before invoking the
// code under test.
let mockSingleResult: { data: any; error: any } = {
  data: null,
  error: { message: "no rows found" },
};

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
        signUp: vi.fn(() => Promise.resolve(mockSignUpResult)),
      },
      rpc: vi.fn(() => Promise.resolve(mockRpcResult)),
      from: vi.fn(() => {
        const chain: any = {};
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.not = vi.fn(() => chain);
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn(() => Promise.resolve(mockSingleResult));
        // Makes the chain awaitable: `await supabase.from(...).select(...)...`
        // resolves to whatever `mockFromResult` currently holds.
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve(mockFromResult).then(resolve, reject);
        return chain;
      }),
    },
  };
});

// Default `from` mock implementation, captured so tests that override it
// with `mockImplementation` can restore it afterwards.
function defaultFromImpl() {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(mockSingleResult));
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(mockFromResult).then(resolve, reject);
  return chain;
}

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
  beforeEach(() => {
    (supabase.from as any).mockClear();
  });

  afterEach(() => {
    mockSingleResult = { data: null, error: { message: "no rows found" } };
    (supabase.from as any).mockImplementation(defaultFromImpl);
  });

  it("creates profile + parent role when the signed-in user has no existing row", async () => {
    mockSingleResult = { data: null, error: { message: "no rows found" } };
    const user = {
      id: "user-1",
      email: "a@b.com",
      user_metadata: { full_name: "Jane Doe" },
    };

    const callbackFired = new Promise<void>(resolve => {
      authApi.onAuthStateChange(() => resolve());
    });
    const handler = authCallbacks[authCallbacks.length - 1];
    handler("SIGNED_IN", { user });

    await withTimeout(callbackFired, 200);

    expect(supabase.from).toHaveBeenCalledWith("users");
    expect(supabase.from).toHaveBeenCalledWith("user_roles");
  });

  it("does not insert when a profile row already exists", async () => {
    mockSingleResult = { data: { id: "user-1" }, error: null };
    const user = { id: "user-1", email: "a@b.com" };

    const fromCalls: string[] = [];
    (supabase.from as any).mockImplementation((table: string) => {
      fromCalls.push(table);
      const chain: any = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.not = vi.fn(() => chain);
      chain.insert = vi.fn(() => chain);
      chain.single = vi.fn(() => Promise.resolve(mockSingleResult));
      chain.then = (resolve: any, reject: any) =>
        Promise.resolve(mockFromResult).then(resolve, reject);
      return chain;
    });

    const callbackFired = new Promise<void>(resolve => {
      authApi.onAuthStateChange(() => resolve());
    });
    const handler = authCallbacks[authCallbacks.length - 1];
    handler("SIGNED_IN", { user });

    await withTimeout(callbackFired, 200);

    expect(fromCalls).toEqual(["users"]);
    expect(fromCalls).not.toContain("user_roles");
  });

  it("delivers the signed-in user to the callback only after the ensure step settles", async () => {
    mockSingleResult = { data: null, error: { message: "no rows found" } };
    const order: string[] = [];
    const user = { id: "user-1", email: "a@b.com" };

    (supabase.from as any).mockImplementation((table: string) => {
      const chain: any = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.not = vi.fn(() => chain);
      chain.insert = vi.fn(() => chain);
      chain.single = vi.fn(async () => {
        order.push(`single:${table}`);
        return mockSingleResult;
      });
      chain.then = (resolve: any, reject: any) =>
        Promise.resolve(mockFromResult).then(resolve, reject);
      return chain;
    });

    const callbackFired = new Promise<void>(resolve => {
      authApi.onAuthStateChange(() => {
        order.push("callback");
        resolve();
      });
    });
    const handler = authCallbacks[authCallbacks.length - 1];
    handler("SIGNED_IN", { user });

    await withTimeout(callbackFired, 200);

    expect(order).toEqual(["single:users", "callback"]);
  });

  it("delivers a non-SIGNED_IN event to the callback immediately, unaffected by the ensure logic", async () => {
    const received: any[] = [];
    authApi.onAuthStateChange(user => received.push(user));

    const handler = authCallbacks[authCallbacks.length - 1];
    const user = { id: "user-1", email: "a@b.com" };

    await withTimeout(
      Promise.resolve(handler("TOKEN_REFRESHED", { user })),
      50
    );

    expect(received).toEqual([user]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("authApi.signUp", () => {
  beforeEach(() => {
    (supabase.from as any).mockClear();
  });

  it("does not touch public.users/user_roles directly, relying on the SIGNED_IN listener", async () => {
    await authApi.signUp("a@b.com", "password123");

    expect(supabase.from).not.toHaveBeenCalled();
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

    expect(supabase.rpc).toHaveBeenCalledWith("get_class_enrolled_children", {
      p_class_id: "class-1",
    });

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
