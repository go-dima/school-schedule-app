// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AuthChangeHandler = (user: any) => void;

const authCallbacks: AuthChangeHandler[] = [];

vi.mock("../services/api", () => {
  return {
    authApi: {
      onAuthStateChange: vi.fn((cb: AuthChangeHandler) => {
        authCallbacks.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    usersApi: {
      // Simulates the users-lookup query stalling forever, which is the
      // real-world failure mode: a stuck request must not leave `loading`
      // stuck too.
      getUserProfile: vi.fn(() => new Promise(() => {})),
      getUserRoles: vi.fn(() => Promise.resolve([])),
      updateUserProfile: vi.fn(),
    },
  };
});

const { useAuth } = await import("./useAuth");

describe("useAuth", () => {
  beforeEach(() => {
    authCallbacks.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears loading instead of hanging forever when the profile lookup never resolves", async () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(false);

    const handler = authCallbacks[authCallbacks.length - 1];
    act(() => {
      handler({ id: "user-1" });
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(result.current.loading).toBe(false);
  });
});
