// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import type { UserRole, UserWithRoles } from "../types";
import {
  stubMatchMedia,
  visibleOptionElements,
  visibleOptions,
} from "../testUtils/antdDom";

const makeUser = (
  id: string,
  role: UserRole,
  names: { firstName?: string; lastName?: string; displayName?: string }
): UserWithRoles => ({
  id,
  email: `${id}@example.com`,
  ...names,
  scope: "prod",
  createdAt: "2026-09-01",
  roles: [
    {
      id: `${id}-role`,
      userId: id,
      role,
      approved: true,
      createdAt: "",
      updatedAt: "",
    },
  ],
});

const users = [
  makeUser("u1", "staff", {
    firstName: "אורית",
    lastName: "שמש",
    displayName: "המורה אורית",
  }),
  makeUser("u2", "parent", { firstName: "נועה", lastName: "כהן" }),
  makeUser("u3", "staff", { firstName: "Dana", lastName: "Levi" }),
  makeUser("u4", "parent", { firstName: "יואב", lastName: "לוי" }),
];

vi.mock("../services/api", () => ({
  ApiError: class ApiError extends Error {},
  childrenApi: {},
  usersApi: { getAllUsersWithRoles: () => Promise.resolve(users) },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1" },
    roleFlags: { isAdmin: true },
  }),
}));
vi.mock("../utils/env", () => ({
  isTestScopeEnabled: () => false,
  getAllowedScopes: () => ["prod"],
  env: {},
}));
vi.mock("../utils/analytics", () => ({
  trackEvent: vi.fn(),
  AnalyticsEvent: {},
}));

const { default: UserManagementPage } = await import("./UserManagementPage");

const rowIds = () =>
  Array.from(document.querySelectorAll(".ant-table-row")).map(row =>
    row.getAttribute("data-row-key")
  );

const renderPage = async () => {
  render(<UserManagementPage />);
  await waitFor(() => expect(rowIds()).toHaveLength(4));
  // The name search is the first combobox (the table pager has another).
  const searchBox = screen.getAllByRole("combobox")[0] as HTMLInputElement;
  const typeSearch = (value: string) =>
    fireEvent.change(searchBox, { target: { value } });
  return { searchBox, typeSearch };
};

describe("UserManagementPage name filter", () => {
  beforeAll(stubMatchMedia);

  it("matches first + last name, trimmed and case-insensitively", async () => {
    const { typeSearch } = await renderPage();

    typeSearch(" dana l ");
    expect(rowIds()).toEqual(["u3"]);

    typeSearch("לוי");
    expect(rowIds()).toEqual(["u4"]);
  });

  it("matches the display name", async () => {
    const { typeSearch } = await renderPage();

    typeSearch("המורה");

    expect(rowIds()).toEqual(["u1"]);
  });

  it("does not match across the full name and the display name", async () => {
    const { typeSearch } = await renderPage();

    // "...שמש" + "המורה..." only meet if the two names are joined.
    typeSearch("שמש המורה");

    expect(rowIds()).toEqual([]);
  });

  it("does not match the email", async () => {
    const { typeSearch } = await renderPage();

    typeSearch("example.com");

    expect(rowIds()).toEqual([]);
  });

  it("suggests each matching name and filters to a picked one", async () => {
    const { searchBox, typeSearch } = await renderPage();

    typeSearch("אורית");
    expect(visibleOptions()).toEqual(["אורית שמש", "המורה אורית"]);

    fireEvent.click(visibleOptionElements()[1]);

    expect(searchBox.value).toBe("המורה אורית");
    expect(rowIds()).toEqual(["u1"]);
  });

  it("combines with the role toggle", async () => {
    const { typeSearch } = await renderPage();
    typeSearch("ו");
    expect(rowIds()).toEqual(["u1", "u2", "u4"]);

    // Double-click isolates one role.
    fireEvent.doubleClick(
      screen.getByRole("button", { name: i18n.t("roles.parent") })
    );

    expect(rowIds()).toEqual(["u2", "u4"]);
  });
});
