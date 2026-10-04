import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOAuthRedirectUrl,
  captureRequestedRoleFromUrl,
  parseRequestedRole,
  resolveRequestedRole,
} from "./requestedRole";

// A window with just what captureRequestedRoleFromUrl touches.
function fakeWindow(href: string) {
  const win = {
    location: { href },
    history: {
      state: { key: "s" },
      replaceState: vi.fn((_state: unknown, _title: string, url: string) => {
        win.location.href = new URL(url, href).toString();
      }),
    },
  };
  return win;
}

describe("buildOAuthRedirectUrl", () => {
  it("adds the role as a query parameter", () => {
    expect(buildOAuthRedirectUrl("https://app.test", "child")).toBe(
      "https://app.test/?requested_role=child"
    );
  });

  it("returns the origin unchanged without a role", () => {
    expect(buildOAuthRedirectUrl("https://app.test")).toBe("https://app.test");
  });
});

describe("parseRequestedRole", () => {
  it("accepts only requestable roles", () => {
    expect(parseRequestedRole("staff")).toBe("staff");
    expect(parseRequestedRole("admin")).toBeNull();
    expect(parseRequestedRole(null)).toBeNull();
  });
});

describe("captureRequestedRoleFromUrl", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the role and strips only that parameter, keeping the OAuth hash", () => {
    const win = fakeWindow(
      "https://app.test/?requested_role=staff#access_token=abc&refresh_token=def"
    );

    expect(captureRequestedRoleFromUrl(win as unknown as Window)).toBe("staff");

    expect(store.get("requestedRole")).toBe("staff");
    expect(win.history.replaceState).toHaveBeenCalledWith(
      { key: "s" },
      "",
      "/#access_token=abc&refresh_token=def"
    );
  });

  it("keeps other query parameters (PKCE code)", () => {
    const win = fakeWindow("https://app.test/?requested_role=child&code=xyz");

    captureRequestedRoleFromUrl(win as unknown as Window);

    expect(win.history.replaceState).toHaveBeenCalledWith(
      { key: "s" },
      "",
      "/?code=xyz"
    );
    expect(store.get("requestedRole")).toBe("child");
  });

  it("strips a tampered value without storing it", () => {
    const win = fakeWindow("https://app.test/?requested_role=admin");

    expect(captureRequestedRoleFromUrl(win as unknown as Window)).toBeNull();

    expect(store.has("requestedRole")).toBe(false);
    expect(win.history.replaceState).toHaveBeenCalledWith(
      { key: "s" },
      "",
      "/"
    );
  });

  it("leaves a URL without the parameter untouched", () => {
    const win = fakeWindow("https://app.test/schedule#access_token=abc");

    expect(captureRequestedRoleFromUrl(win as unknown as Window)).toBeNull();

    expect(win.history.replaceState).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it("does nothing without a window", () => {
    expect(captureRequestedRoleFromUrl(undefined)).toBeNull();
  });
});

describe("resolveRequestedRole", () => {
  it("uses the metadata role first", () => {
    expect(resolveRequestedRole({ requested_role: "child" }, "staff")).toBe(
      "child"
    );
  });

  it("falls back to the stored role when metadata has none", () => {
    expect(resolveRequestedRole({ full_name: "Noa" }, "staff")).toBe("staff");
    expect(resolveRequestedRole(undefined, "child")).toBe("child");
  });

  it("falls back to parent when neither is set", () => {
    expect(resolveRequestedRole(undefined, null)).toBe("parent");
    expect(resolveRequestedRole({}, undefined)).toBe("parent");
  });

  it("ignores roles that can't be requested", () => {
    expect(resolveRequestedRole({ requested_role: "admin" }, "child")).toBe(
      "child"
    );
    expect(resolveRequestedRole({ requested_role: "moderator" }, null)).toBe(
      "parent"
    );
    expect(resolveRequestedRole(undefined, "admin")).toBe("parent");
    expect(resolveRequestedRole({ requested_role: 42 }, "nope")).toBe("parent");
  });
});
