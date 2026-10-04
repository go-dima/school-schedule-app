// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import type { Child } from "../types";
import { GetGradeName } from "@/utils/grades";
import {
  pressEnter,
  shownText,
  stubMatchMedia,
  visibleOptionElements,
  visibleOptions,
} from "../testUtils/antdDom";

const auth = { isAdmin: false };
const createChild = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    roleFlags: { isAdmin: auth.isAdmin },
    user: { id: "me" },
    permissions: {},
  }),
}));
vi.mock("../contexts/AllChildrenContext", () => ({
  useAllChildrenContext: () => ({ createChild }),
}));
vi.mock("../services/api", () => ({ childrenApi: {} }));
vi.mock("../utils/env", () => ({
  isTestScopeEnabled: () => true,
  getAllowedScopes: () => ["prod", "test"],
  env: {},
}));

const { StudentSearchSelector } = await import("./StudentSearchSelector");

const makeChild = (
  id: string,
  firstName: string,
  lastName: string,
  grade: number
): Child =>
  ({
    id,
    firstName,
    lastName,
    grade,
    groupNumber: 1,
    trackNumber: null,
    scope: "prod",
    createdAt: "",
    updatedAt: "",
  }) as Child;

const children = [
  makeChild("c1", "נועה", "כהן", 3),
  makeChild("c2", "יואב", "לוי", 4),
  makeChild("c3", "Dana", "Levi", 2),
];

const input = () => screen.getByRole("combobox") as HTMLInputElement;
const open = () => fireEvent.mouseDown(input());
const type = (value: string) =>
  fireEvent.change(input(), { target: { value } });
const addRowText = (name: string) =>
  i18n.t("students.search.addStudent", { name });

// Mirrors SchedulePage: the parent owns the selected id.
const Picker = ({
  initial,
  onChildSelect,
  isCreateAllowed = true,
}: {
  initial?: string;
  onChildSelect?: (id: string | undefined) => void;
  isCreateAllowed?: boolean;
}) => {
  const [selected, setSelected] = useState<string | undefined>(initial);
  return (
    <StudentSearchSelector
      children={children}
      selectedChildId={selected ?? null}
      onChildSelect={id => {
        setSelected(id);
        onChildSelect?.(id);
      }}
      mode="select"
      isCreateAllowed={isCreateAllowed}
    />
  );
};

// Mirrors StudentsPage: the parent owns the search text.
const Filter = ({ onSearch }: { onSearch?: (v: string) => void }) => {
  const [text, setText] = useState("");
  return (
    <StudentSearchSelector
      children={children}
      mode="search"
      value={text}
      onSearchChange={v => {
        setText(v);
        onSearch?.(v);
      }}
    />
  );
};

describe("StudentSearchSelector (current behavior)", () => {
  beforeAll(stubMatchMedia);
  beforeEach(() => {
    auth.isAdmin = false;
    createChild.mockReset();
  });

  describe('mode="select" (pick)', () => {
    it("lists every student with their grade on focus", () => {
      render(<Picker />);
      fireEvent.mouseDown(input());

      expect(visibleOptions()).toEqual([
        `נועה כהן - ${GetGradeName(3)}`,
        `יואב לוי - ${GetGradeName(4)}`,
        `Dana Levi - ${GetGradeName(2)}`,
      ]);
    });

    it("narrows by first, last or full name, case-insensitively", () => {
      render(<Picker />);
      open();
      type("dana l");

      expect(visibleOptions()).toEqual([`Dana Levi - ${GetGradeName(2)}`]);
    });

    it("does not trim the typed text", () => {
      render(<Picker />);
      open();
      type(" נועה");

      expect(visibleOptions()).toEqual([addRowText(" נועה")]);
    });

    it("selects the clicked student and shows their name", () => {
      const onChildSelect = vi.fn();
      render(<Picker onChildSelect={onChildSelect} />);
      open();
      type("יואב");
      fireEvent.click(visibleOptionElements()[0]);

      expect(onChildSelect).toHaveBeenLastCalledWith("c2");
      expect(shownText()).toBe("יואב לוי");
    });

    it("does not pick the first match on Enter", () => {
      const onChildSelect = vi.fn();
      render(<Picker onChildSelect={onChildSelect} />);
      open();
      type("יואב");
      pressEnter(input());

      expect(onChildSelect).not.toHaveBeenCalled();
    });

    it("clears the selection as soon as the text differs from the name", () => {
      const onChildSelect = vi.fn();
      render(<Picker initial="c1" onChildSelect={onChildSelect} />);
      expect(shownText()).toBe("נועה כהן");

      open();
      type("נועה כה");

      expect(onChildSelect).toHaveBeenLastCalledWith(undefined);
    });

    it("keeps the typed text, not the name, on blur", () => {
      render(<Picker initial="c1" />);
      open();
      type("נועה כה");
      fireEvent.blur(input());

      expect(shownText()).toBe("נועה כה");
    });

    it("clears to undefined with the clear button", () => {
      const onChildSelect = vi.fn();
      render(<Picker initial="c1" onChildSelect={onChildSelect} />);
      fireEvent.mouseDown(document.querySelector(".ant-select-clear")!);

      expect(onChildSelect).toHaveBeenLastCalledWith(undefined);
      expect(shownText()).toBe("");
    });

    it("offers to add a student when nothing matches", () => {
      render(<Picker />);
      open();
      type("שירה גל");

      expect(visibleOptions()).toEqual([addRowText("שירה גל")]);
    });

    it("hides the add row when creating isn't allowed", () => {
      render(<Picker isCreateAllowed={false} />);
      open();
      type("שירה גל");

      // jsdom never finishes the close animation, so check for the row only.
      expect(visibleOptions()).not.toContain(addRowText("שירה גל"));
    });
  });

  describe('mode="search" (filter)', () => {
    it("lists every student without a grade on focus", () => {
      render(<Filter />);
      fireEvent.mouseDown(input());

      expect(visibleOptions()).toEqual(["נועה כהן", "יואב לוי", "Dana Levi"]);
    });

    it("reports the typed text", () => {
      const onSearch = vi.fn();
      render(<Filter onSearch={onSearch} />);
      type("נוע");

      expect(onSearch).toHaveBeenLastCalledWith("נוע");
      expect(visibleOptions()).toEqual(["נועה כהן"]);
    });

    it("fills in the picked suggestion's name", () => {
      const onSearch = vi.fn();
      render(<Filter onSearch={onSearch} />);
      type("יו");
      fireEvent.click(visibleOptionElements()[0]);

      expect(onSearch).toHaveBeenLastCalledWith("יואב לוי");
      expect(input().value).toBe("יואב לוי");
    });
  });

  describe("add student", () => {
    it("opens the child form prefilled with the typed name", async () => {
      render(<Picker />);
      open();
      type("שירה בת גל");
      fireEvent.click(visibleOptionElements()[0]);

      expect(
        await screen.findByText(i18n.t("students.page.addModalTitle"))
      ).toBeTruthy();
      expect(
        (
          screen.getByPlaceholderText(
            i18n.t("form.child.firstNamePlaceholder")
          ) as HTMLInputElement
        ).value
      ).toBe("שירה");
      expect(
        (
          screen.getByPlaceholderText(
            i18n.t("form.child.lastNamePlaceholder")
          ) as HTMLInputElement
        ).value
      ).toBe("בת גל");
    });

    it("hides the scope field from non-admins", async () => {
      render(<Picker />);
      open();
      type("שירה גל");
      fireEvent.click(visibleOptionElements()[0]);
      await screen.findByText(i18n.t("students.page.addModalTitle"));

      expect(screen.queryByText(i18n.t("scope.selector.label"))).toBeNull();
    });

    it("shows the scope field to admins", async () => {
      auth.isAdmin = true;
      render(<Picker />);
      open();
      type("שירה גל");
      fireEvent.click(visibleOptionElements()[0]);
      await screen.findByText(i18n.t("students.page.addModalTitle"));

      expect(screen.getByText(i18n.t("scope.selector.label"))).toBeTruthy();
    });
  });
});
