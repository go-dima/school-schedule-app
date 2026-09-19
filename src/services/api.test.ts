import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared mutable state for the mocked env module below, set per-test to
// simulate production vs non-production. `vi.hoisted` makes it available
// both inside the (hoisted) `vi.mock` factory and in test bodies.
const envState = vi.hoisted(() => ({ isProduction: false }));

vi.mock("../utils/env", () => ({
  env: new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === "isProduction" ? envState.isProduction : undefined,
    }
  ),
  getAllowedScopes: () => (envState.isProduction ? ["prod"] : ["prod", "test"]),
  isTestScopeWriteAllowed: () => !envState.isProduction,
}));

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

// Fixture data resolved by the `auth.signOut(...)` mock below when it is
// awaited. Defaults to a plain success (no error).
let mockSignOutResult: { error: any } = { error: null };

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
        signOut: vi.fn(() => Promise.resolve(mockSignOutResult)),
      },
      rpc: vi.fn(() => Promise.resolve(mockRpcResult)),
      from: vi.fn(() => {
        const chain: any = {};
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.neq = vi.fn(() => chain);
        chain.in = vi.fn(() => chain);
        chain.ilike = vi.fn(() => chain);
        chain.not = vi.fn(() => chain);
        chain.insert = vi.fn(() => chain);
        chain.update = vi.fn(() => chain);
        chain.order = vi.fn(() => chain);
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
  chain.neq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.ilike = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(mockSingleResult));
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(mockFromResult).then(resolve, reject);
  return chain;
}

// Import after the mock so `api.ts` picks up the mocked `./supabase` module.
const { authApi, scheduleApi, scheduleOverridesApi, childrenApi, classesApi } =
  await import("./api");
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

describe("authApi.signOut", () => {
  afterEach(() => {
    mockSignOutResult = { error: null };
  });

  it("resolves without throwing on a plain success", async () => {
    await expect(authApi.signOut()).resolves.toBeUndefined();
  });

  it("resolves without throwing when the session is already missing", async () => {
    mockSignOutResult = {
      error: {
        name: "AuthSessionMissingError",
        message: "Auth session missing!",
      },
    };

    await expect(authApi.signOut()).resolves.toBeUndefined();
  });

  it("throws an ApiError for any other sign-out failure", async () => {
    mockSignOutResult = {
      error: { name: "AuthApiError", message: "network error" },
    };

    await expect(authApi.signOut()).rejects.toThrow("network error");
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
    envState.isProduction = false;
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
          added_by_user_id: "user-b",
          added_by_first_name: "מיכל",
          added_by_last_name: "רוזן",
          added_by_at: "2024-02-01T00:00:00.000Z",
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
          added_by_user_id: "user-a",
          added_by_first_name: null,
          added_by_last_name: null,
          added_by_at: "2024-02-03T00:00:00.000Z",
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
          added_by_user_id: "user-c",
          added_by_first_name: "יוסי",
          added_by_last_name: "כהן",
          added_by_at: "2024-02-05T00:00:00.000Z",
        },
      ],
      error: null,
    };

    const result = await scheduleApi.getClassEnrolledChildren("class-1");

    expect(supabase.rpc).toHaveBeenCalledWith("get_class_enrolled_children", {
      p_class_id: "class-1",
      target_scope: ["prod", "test"],
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
        createdBy: null,
        createdByName: null,
        createdAt: "2024-01-05T00:00:00.000Z",
        updatedAt: "2024-01-06T00:00:00.000Z",
        addedByUserId: "user-c",
        addedByFirstName: "יוסי",
        addedByLastName: "כהן",
        addedByAt: "2024-02-05T00:00:00.000Z",
      },
      {
        id: "child-b",
        firstName: "דוד",
        lastName: "לוי",
        grade: 1,
        groupNumber: 2,
        trackNumber: null,
        scope: "prod",
        createdBy: null,
        createdByName: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        addedByUserId: "user-b",
        addedByFirstName: "מיכל",
        addedByLastName: "רוזן",
        addedByAt: "2024-02-01T00:00:00.000Z",
      },
      {
        id: "child-a",
        firstName: "אביגיל",
        lastName: "כהן",
        grade: 2,
        groupNumber: null,
        trackNumber: 1,
        scope: "prod",
        createdBy: null,
        createdByName: null,
        createdAt: "2024-01-03T00:00:00.000Z",
        updatedAt: "2024-01-04T00:00:00.000Z",
        addedByUserId: "user-a",
        addedByFirstName: null,
        addedByLastName: null,
        addedByAt: "2024-02-03T00:00:00.000Z",
      },
    ]);
  });

  it("passes only the prod scope when running in production", async () => {
    envState.isProduction = true;
    mockRpcResult = { data: [], error: null };

    await scheduleApi.getClassEnrolledChildren("class-1");

    expect(supabase.rpc).toHaveBeenCalledWith("get_class_enrolled_children", {
      p_class_id: "class-1",
      target_scope: ["prod"],
    });
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

describe("childrenApi.findLocalDuplicateChildren", () => {
  afterEach(() => {
    mockFromResult = { data: [], error: null };
    (supabase.from as any).mockClear();
  });

  it("queries children directly (no RPC) filtered by name+grade and maps creator info", async () => {
    mockFromResult = {
      data: [
        {
          id: "child-1",
          grade: 6,
          created_by: "user-1",
          creator: {
            first_name: "נתלי",
            last_name: "צינדורף",
            email: "natalie@example.com",
          },
        },
      ],
      error: null,
    };

    const currentUserId = "user-2";
    const result = await childrenApi.findLocalDuplicateChildren(
      "ליאו",
      "פלד",
      6,
      undefined,
      currentUserId
    );

    expect(result).toEqual([
      {
        id: "child-1",
        grade: 6,
        createdByUserId: "user-1",
        createdByName: "נתלי צינדורף",
        createdByIsSelf: false,
      },
    ]);
  });

  it("excludes the given child id from results", async () => {
    mockFromResult = { data: [], error: null };

    await childrenApi.findLocalDuplicateChildren(
      "ליאו",
      "פלד",
      6,
      "child-1",
      "user-2"
    );

    expect(supabase.from).toHaveBeenCalledWith("children");
    // The mocked `from(...)` chain returns a fresh object per call (see the
    // mock setup above), so grab the specific chain instance this call
    // produced to inspect how `.neq(...)` was actually invoked on it.
    const chain = (supabase.from as any).mock.results[0].value;
    expect(chain.neq).toHaveBeenCalledWith("id", "child-1");
  });
});

describe("childrenApi.claimChild", () => {
  afterEach(() => {
    mockRpcResult = { data: [], error: null };
  });

  it("calls claim_child RPC and returns the mapped relationship", async () => {
    mockRpcResult = {
      data: {
        id: "rel-1",
        parent_id: "user-1",
        child_id: "child-1",
        is_primary: true,
        created_at: "2026-09-14T00:00:00Z",
      },
      error: null,
    };

    const result = await childrenApi.claimChild("child-1");

    expect(supabase.rpc).toHaveBeenCalledWith("claim_child", {
      p_child_id: "child-1",
    });
    expect(result).toEqual({
      id: "rel-1",
      parentId: "user-1",
      childId: "child-1",
      isPrimary: true,
      createdAt: "2026-09-14T00:00:00Z",
    });
  });

  it("throws when the RPC errors", async () => {
    mockRpcResult = {
      data: null,
      error: {
        message: "This child already has a linked parent and cannot be claimed",
      },
    };

    await expect(childrenApi.claimChild("child-1")).rejects.toThrow(
      "This child already has a linked parent and cannot be claimed"
    );
  });
});

// Correlates a `supabase.from(table)` call with the chain object it
// returned, since the shared mock returns a fresh chain per call.
function fromChainFor(table: string) {
  const calls = (supabase.from as any).mock.calls;
  const idx = calls.findIndex((call: any[]) => call[0] === table);
  return (supabase.from as any).mock.results[idx].value;
}

describe("classesApi.getClasses", () => {
  beforeEach(() => {
    (supabase.from as any).mockClear();
    mockFromResult = { data: [], error: null };
  });

  afterEach(() => {
    envState.isProduction = false;
  });

  it("queries only the prod scope in production", async () => {
    envState.isProduction = true;

    await classesApi.getClasses();

    expect(fromChainFor("classes").in).toHaveBeenCalledWith("scope", ["prod"]);
  });

  it("queries both scopes outside production", async () => {
    envState.isProduction = false;

    await classesApi.getClasses();

    expect(fromChainFor("classes").in).toHaveBeenCalledWith("scope", [
      "prod",
      "test",
    ]);
  });
});

describe("childrenApi.getChildById", () => {
  beforeEach(() => {
    (supabase.from as any).mockClear();
    mockSingleResult = {
      data: {
        id: "child-1",
        first_name: "אבי",
        last_name: "כהן",
        grade: 3,
        group_number: 1,
        track_number_draft: null,
        track_number_committed: null,
        scope: "prod",
        created_by: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    };
  });

  afterEach(() => {
    envState.isProduction = false;
    mockSingleResult = { data: null, error: { message: "no rows found" } };
  });

  it("restricts the query to allowed scopes outside production", async () => {
    envState.isProduction = false;

    await childrenApi.getChildById("child-1");

    expect(fromChainFor("children").in).toHaveBeenCalledWith("scope", [
      "prod",
      "test",
    ]);
  });

  it("restricts the query to prod-only scope in production", async () => {
    envState.isProduction = true;

    await childrenApi.getChildById("child-1");

    expect(fromChainFor("children").in).toHaveBeenCalledWith("scope", ["prod"]);
  });

  it("surfaces a not-found ApiError when the underlying query excludes the row", async () => {
    envState.isProduction = true;
    mockSingleResult = {
      data: null,
      error: {
        message: "JSON object requested, multiple (or no) rows returned",
      },
    };

    await expect(childrenApi.getChildById("child-1")).rejects.toThrow();
  });
});

describe("childrenApi.getChildWithParents", () => {
  beforeEach(() => {
    (supabase.from as any).mockClear();
    mockSingleResult = {
      data: {
        id: "child-1",
        first_name: "אבי",
        last_name: "כהן",
        grade: 3,
        group_number: 1,
        track_number_draft: null,
        track_number_committed: null,
        scope: "prod",
        created_by: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        parents: [],
      },
      error: null,
    };
  });

  afterEach(() => {
    envState.isProduction = false;
    mockSingleResult = { data: null, error: { message: "no rows found" } };
  });

  it("restricts the query to allowed scopes", async () => {
    envState.isProduction = true;

    await childrenApi.getChildWithParents("child-1");

    expect(fromChainFor("children_with_parents").in).toHaveBeenCalledWith(
      "scope",
      ["prod"]
    );
  });
});

describe("write-path scope guard", () => {
  afterEach(() => {
    envState.isProduction = false;
    mockFromResult = { data: [], error: null };
    mockRpcResult = { data: [], error: null };
  });

  const baseClass = {
    title: "Math",
    description: "",
    teacher: "Mrs. Cohen",
    slots: [],
    grades: [1],
    isMandatory: false,
    isDouble: false,
    groupNumber: null,
    trackNumber: null,
    room: "101",
  };

  it("classesApi.createClass rejects scope: test in production", async () => {
    envState.isProduction = true;

    await expect(
      classesApi.createClass({ ...baseClass, scope: "test" })
    ).rejects.toThrow();
  });

  it("classesApi.createClass allows scope: test outside production", async () => {
    envState.isProduction = false;
    mockFromResult = { data: [{ id: "class-1" }], error: null };

    await expect(
      classesApi.createClass({ ...baseClass, scope: "test" })
    ).resolves.toBeDefined();
  });

  it("classesApi.updateClass rejects scope: test in production", async () => {
    envState.isProduction = true;

    await expect(
      classesApi.updateClass("class-1", { scope: "test" })
    ).rejects.toThrow();
  });

  it("childrenApi.createChild rejects scope: test in production", async () => {
    envState.isProduction = true;

    await expect(
      childrenApi.createChild("אבי", "כהן", 3, 1, "test")
    ).rejects.toThrow();
  });

  it("childrenApi.createChild allows scope: test outside production", async () => {
    envState.isProduction = false;
    mockRpcResult = {
      data: {
        id: "child-1",
        first_name: "אבי",
        last_name: "כהן",
        grade: 3,
        group_number: 1,
        track_number_draft: null,
        scope: "test",
        created_by: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    };

    await expect(
      childrenApi.createChild("אבי", "כהן", 3, 1, "test")
    ).resolves.toBeDefined();
  });

  it("childrenApi.updateChild rejects scope: test in production", async () => {
    envState.isProduction = true;

    await expect(
      childrenApi.updateChild("child-1", { scope: "test" })
    ).rejects.toThrow();
  });
});

describe("scheduleOverridesApi", () => {
  const originalFrom = supabase.from;
  const originalGetUser = supabase.auth.getUser;

  const rawTimeSlot = {
    id: "slot-1",
    name: "שיעור ראשון",
    start_time: "08:00",
    end_time: "08:45",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  };

  const mockTimeSlotsFrom = (table: string) => {
    if (table === "time_slots") {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [rawTimeSlot], error: null }),
      };
    }
    return undefined;
  };

  afterEach(() => {
    supabase.from = originalFrom;
    supabase.auth.getUser = originalGetUser;
  });

  it("getOverrides: fetches a child's overrides filtered by child_id and hydrates timeSlot", async () => {
    const rawOverride = {
      id: "override-1",
      child_id: "child-1",
      title: "חונכות אישית",
      teacher: "דנה כהן",
      room: "חדר 5",
      day_of_week: 2,
      time_slot_id: "slot-1",
      scope: "prod",
      created_by: "user-9",
      created_at: "2024-02-01T00:00:00.000Z",
      updated_at: "2024-02-02T00:00:00.000Z",
    };

    const eqMock = vi.fn().mockResolvedValue({
      data: [rawOverride],
      error: null,
    });
    supabase.from = vi.fn((table: string) => {
      const timeSlotsChain = mockTimeSlotsFrom(table);
      if (timeSlotsChain) return timeSlotsChain;
      if (table === "schedule_overrides") {
        return { select: vi.fn().mockReturnThis(), eq: eqMock };
      }
      throw new Error(`unexpected table ${table}`);
    }) as any;

    const result = await scheduleOverridesApi.getOverrides("child-1");

    expect(eqMock).toHaveBeenCalledWith("child_id", "child-1");
    expect(result).toEqual([
      {
        id: "override-1",
        childId: "child-1",
        title: "חונכות אישית",
        teacher: "דנה כהן",
        room: "חדר 5",
        dayOfWeek: 2,
        timeSlotId: "slot-1",
        scope: "prod",
        createdBy: "user-9",
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2024-02-02T00:00:00.000Z",
        timeSlot: {
          id: "slot-1",
          name: "שיעור ראשון",
          startTime: "08:00",
          endTime: "08:45",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    ]);
  });

  it("createOverride: resolves created_by from auth.getUser and inserts a snake_case payload", async () => {
    supabase.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-9" } },
      error: null,
    }) as any;

    const insertedRow = {
      id: "override-2",
      child_id: "child-1",
      title: "שיעור חורג",
      teacher: "יעל לוי",
      room: "חדר 3",
      day_of_week: 1,
      time_slot_id: "slot-1",
      scope: "test",
      created_by: "user-9",
      created_at: "2024-03-01T00:00:00.000Z",
      updated_at: "2024-03-01T00:00:00.000Z",
    };

    const insertMock = vi.fn().mockReturnThis();
    const selectMock = vi.fn().mockReturnThis();
    const singleMock = vi
      .fn()
      .mockResolvedValue({ data: insertedRow, error: null });

    supabase.from = vi.fn((table: string) => {
      const timeSlotsChain = mockTimeSlotsFrom(table);
      if (timeSlotsChain) return timeSlotsChain;
      if (table === "schedule_overrides") {
        return {
          insert: insertMock,
          select: selectMock,
          single: singleMock,
        };
      }
      throw new Error(`unexpected table ${table}`);
    }) as any;

    const result = await scheduleOverridesApi.createOverride({
      childId: "child-1",
      title: "שיעור חורג",
      teacher: "יעל לוי",
      room: "חדר 3",
      dayOfWeek: 1,
      timeSlotId: "slot-1",
      scope: "test",
    });

    expect(insertMock).toHaveBeenCalledWith([
      {
        child_id: "child-1",
        title: "שיעור חורג",
        teacher: "יעל לוי",
        room: "חדר 3",
        day_of_week: 1,
        time_slot_id: "slot-1",
        scope: "test",
        created_by: "user-9",
      },
    ]);
    expect(result.id).toBe("override-2");
    expect(result.createdBy).toBe("user-9");
    expect(result.timeSlot.id).toBe("slot-1");
  });

  it("createOverride: throws when the user is not authenticated", async () => {
    supabase.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }) as any;

    await expect(
      scheduleOverridesApi.createOverride({
        childId: "child-1",
        title: "שיעור חורג",
        teacher: "יעל לוי",
        room: "חדר 3",
        dayOfWeek: 1,
        timeSlotId: "slot-1",
        scope: "test",
      })
    ).rejects.toThrow("User not authenticated");
  });

  it("updateOverride: sends only the changed fields in snake_case", async () => {
    const updatedRow = {
      id: "override-1",
      child_id: "child-1",
      title: "כותרת חדשה",
      teacher: "דנה כהן",
      room: "חדר 5",
      day_of_week: 3,
      time_slot_id: "slot-1",
      scope: "prod",
      created_by: "user-9",
      created_at: "2024-02-01T00:00:00.000Z",
      updated_at: "2024-02-03T00:00:00.000Z",
    };

    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();
    const selectMock = vi.fn().mockReturnThis();
    const singleMock = vi
      .fn()
      .mockResolvedValue({ data: updatedRow, error: null });

    supabase.from = vi.fn((table: string) => {
      const timeSlotsChain = mockTimeSlotsFrom(table);
      if (timeSlotsChain) return timeSlotsChain;
      if (table === "schedule_overrides") {
        return {
          update: updateMock,
          eq: eqMock,
          select: selectMock,
          single: singleMock,
        };
      }
      throw new Error(`unexpected table ${table}`);
    }) as any;

    const result = await scheduleOverridesApi.updateOverride("override-1", {
      title: "כותרת חדשה",
      dayOfWeek: 3,
    });

    expect(updateMock).toHaveBeenCalledWith({
      title: "כותרת חדשה",
      day_of_week: 3,
    });
    expect(eqMock).toHaveBeenCalledWith("id", "override-1");
    expect(result.title).toBe("כותרת חדשה");
    expect(result.dayOfWeek).toBe(3);
  });

  it("deleteOverride: deletes by id", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });

    supabase.from = vi.fn((table: string) => {
      if (table === "schedule_overrides") {
        return { delete: deleteMock };
      }
      throw new Error(`unexpected table ${table}`);
    }) as any;

    await expect(
      scheduleOverridesApi.deleteOverride("override-1")
    ).resolves.toBeUndefined();

    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", "override-1");
  });

  it("deleteOverride: throws an ApiError when the delete fails", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });

    supabase.from = vi.fn((table: string) => {
      if (table === "schedule_overrides") {
        return { delete: deleteMock };
      }
      throw new Error(`unexpected table ${table}`);
    }) as any;

    await expect(
      scheduleOverridesApi.deleteOverride("override-1")
    ).rejects.toThrow("boom");
  });
});
