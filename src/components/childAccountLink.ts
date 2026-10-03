import type { ChildAccountLink, NewLinkedChild } from "../types";

export type ChildLinkMode = "existing" | "new";

export type ChildLinkNewChild = NewLinkedChild;

/** Draft state of the picker, kept by the parent so it can be reset when the
 * modal closes or the chosen role changes. */
export interface ChildLinkDraft {
  mode: ChildLinkMode;
  childId?: string;
  newChild: Partial<ChildLinkNewChild>;
}

/** What approval sends: an existing student to link, or a new one to create. */
export type ChildLinkValue = ChildAccountLink;

export const EMPTY_CHILD_LINK_DRAFT: ChildLinkDraft = {
  mode: "existing",
  newChild: {},
};

/** The complete value for a draft, or undefined while it's incomplete (the
 * caller keeps its confirm button disabled until then). */
export function childLinkValue(
  draft: ChildLinkDraft
): ChildLinkValue | undefined {
  if (draft.mode === "existing") {
    return draft.childId ? { childId: draft.childId } : undefined;
  }
  const { firstName, lastName, grade, groupNumber } = draft.newChild;
  if (!firstName?.trim() || !lastName?.trim() || !grade) return undefined;
  return {
    newChild: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      grade,
      groupNumber: groupNumber ?? null,
    },
  };
}
