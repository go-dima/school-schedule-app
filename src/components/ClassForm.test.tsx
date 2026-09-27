// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import type { ClassWithTimeSlot, TimeSlot } from "../types";

vi.mock("../hooks/useStaffMembers", () => ({
  useStaffMembers: () => ({ members: [], loading: false }),
}));
vi.mock("../services/supabase", () => ({ supabase: {} }));
vi.mock("../utils/env", () => ({
  isTestScopeEnabled: () => true,
  getAllowedScopes: () => ["prod", "test"],
  env: {},
}));

const { default: ClassForm } = await import("./ClassForm");

const slot: TimeSlot = {
  id: "slot-1",
  name: "שיעור ראשון",
  startTime: "08:00",
  endTime: "08:45",
  createdAt: "",
  updatedAt: "",
};

const testClass: ClassWithTimeSlot = {
  id: "class-1",
  title: "מתמטיקה",
  description: "",
  teacher: "דנה כהן",
  userId: null,
  slots: [{ dayOfWeek: 0, timeSlotId: slot.id, timeSlot: slot }],
  grades: [3],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "",
  scope: "test",
  createdAt: "",
  updatedAt: "",
};

const submitEdit = async (showScope: boolean) => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <ClassForm
      initialValues={testClass}
      timeSlots={[slot]}
      onSubmit={onSubmit}
      onCancel={() => {}}
      isNewLesson={false}
      showScope={showScope}
    />
  );
  fireEvent.click(
    screen.getByRole("button", { name: i18n.t("form.class.updateButton") })
  );
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  return onSubmit.mock.calls[0][0];
};

describe("ClassForm scope on edit", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  // Staff can edit but not create classes, so Class Management hides the
  // scope selector for them -- saving must not move a test class to prod.
  it("keeps a test class's scope when the scope selector is hidden", async () => {
    expect((await submitEdit(false)).scope).toBe("test");
  });

  it("keeps the scope from the selector when it is shown", async () => {
    expect((await submitEdit(true)).scope).toBe("test");
  });
});
