// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingApproval } from "../../types";
import { stubMatchMedia } from "../../testUtils/antdDom";

const api = {
  getPendingApprovalsWithUsers: vi.fn(),
  approveUserWithRole: vi.fn(),
  approveChildUser: vi.fn(),
  adminSetUserScope: vi.fn(),
  rejectRole: vi.fn(),
  getUnlinkedChildren: vi.fn(),
};
const trackEvent = vi.fn();

vi.mock("../../services/api", () => ({
  usersApi: {
    getPendingApprovalsWithUsers: () => api.getPendingApprovalsWithUsers(),
    approveUserWithRole: (...a: unknown[]) => api.approveUserWithRole(...a),
    approveChildUser: (...a: unknown[]) => api.approveChildUser(...a),
    adminSetUserScope: (...a: unknown[]) => api.adminSetUserScope(...a),
    rejectRole: (...a: unknown[]) => api.rejectRole(...a),
  },
  childrenApi: { getUnlinkedChildren: () => api.getUnlinkedChildren() },
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ permissions: { canApproveSignups: true } }),
}));
vi.mock("../../utils/env", () => ({ isTestScopeEnabled: () => true }));
vi.mock("../../utils/analytics", () => ({
  AnalyticsEvent: {
    SignupApproved: "signup_approved",
    SignupRejected: "signup_rejected",
  },
  trackEvent: (...a: unknown[]) => trackEvent(...a),
}));

const { usePendingApprovalsController } = await import(
  "./usePendingApprovalsController"
);

const approval = (role: PendingApproval["role"]): PendingApproval => ({
  id: `approval-${role}`,
  userId: `user-${role}`,
  role,
  approved: false,
  createdAt: "2026-10-01T08:00:00Z",
  updatedAt: "2026-10-01T08:00:00Z",
  user: {
    id: `user-${role}`,
    email: `${role}@example.com`,
    createdAt: "2026-10-01T08:00:00Z",
    updatedAt: "2026-10-01T08:00:00Z",
  },
});

async function renderLoaded(initial: PendingApproval[]) {
  api.getPendingApprovalsWithUsers.mockResolvedValue(initial);
  const hook = renderHook(() => usePendingApprovalsController());
  await waitFor(() => expect(hook.result.current.initialLoading).toBe(false));
  return hook;
}

describe("usePendingApprovalsController", () => {
  beforeEach(() => {
    stubMatchMedia();
    Object.values(api).forEach(fn => fn.mockReset());
    trackEvent.mockReset();
    api.getUnlinkedChildren.mockResolvedValue([]);
  });

  it("loads the pending approvals", async () => {
    const { result } = await renderLoaded([approval("parent")]);
    expect(result.current.pendingApprovals).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.lastRefresh).toBeInstanceOf(Date);
  });

  it("surfaces a load error", async () => {
    api.getPendingApprovalsWithUsers.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePendingApprovalsController());
    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(result.current.error).toBe("boom");
  });

  it("approves with the chosen role, reloads and closes the form", async () => {
    const parent = approval("parent");
    const { result } = await renderLoaded([parent]);

    act(() => result.current.startApproval(parent));
    expect(result.current.approvalForm.open).toBe(true);
    expect(result.current.approvalForm.selectedApproval).toBe(parent);

    api.getPendingApprovalsWithUsers.mockResolvedValue([]);
    await act(() => result.current.approvalForm.confirm({ role: "staff" }));

    expect(api.approveUserWithRole).toHaveBeenCalledWith(
      "user-parent",
      "staff"
    );
    expect(api.adminSetUserScope).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("signup_approved", {
      role: "staff",
    });
    expect(result.current.pendingApprovals).toEqual([]);
    expect(result.current.approvalForm.open).toBe(false);
  });

  it("sets the test scope before approving", async () => {
    const parent = approval("parent");
    const { result } = await renderLoaded([parent]);
    act(() => result.current.startApproval(parent));

    await act(() =>
      result.current.approvalForm.confirm({ role: "parent", scope: "test" })
    );

    expect(api.adminSetUserScope).toHaveBeenCalledWith("user-parent", "test");
    expect(api.adminSetUserScope.mock.invocationCallOrder[0]).toBeLessThan(
      api.approveUserWithRole.mock.invocationCallOrder[0]
    );
  });

  it("does not approve a child account without a complete link", async () => {
    const child = approval("child");
    const { result } = await renderLoaded([child]);
    act(() => result.current.startApproval(child));

    await act(() => result.current.approvalForm.confirm({ role: "child" }));

    expect(api.approveChildUser).not.toHaveBeenCalled();
    expect(api.approveUserWithRole).not.toHaveBeenCalled();
  });

  it("approves a child account with the linked student", async () => {
    const child = approval("child");
    const { result } = await renderLoaded([child]);
    act(() => result.current.startApproval(child));
    act(() =>
      result.current.approvalForm.setChildLink({
        mode: "existing",
        childId: "student-1",
        newChild: {},
      })
    );
    expect(result.current.approvalForm.childLinkComplete).toBe(true);

    await act(() => result.current.approvalForm.confirm({ role: "child" }));

    expect(api.approveChildUser).toHaveBeenCalledWith("user-child", {
      childId: "student-1",
    });
    expect(api.approveUserWithRole).not.toHaveBeenCalled();
  });

  it("keeps the form open when approving fails", async () => {
    const parent = approval("parent");
    const { result } = await renderLoaded([parent]);
    act(() => result.current.startApproval(parent));
    api.approveUserWithRole.mockRejectedValue(new Error("denied"));

    await act(() => result.current.approvalForm.confirm({ role: "parent" }));

    expect(result.current.approvalForm.open).toBe(true);
    expect(result.current.actionLoading).toBeNull();
  });

  it("rejects and reloads", async () => {
    const parent = approval("parent");
    const { result } = await renderLoaded([parent]);
    api.getPendingApprovalsWithUsers.mockResolvedValue([]);

    await act(() => result.current.reject(parent));

    expect(api.rejectRole).toHaveBeenCalledWith("approval-parent");
    expect(trackEvent).toHaveBeenCalledWith("signup_rejected", {
      role: "parent",
    });
    expect(result.current.pendingApprovals).toEqual([]);
  });
});
