import type { DuplicateChildMatch } from "../types";

export type DuplicateWarningDecision =
  | { kind: "none" }
  | { kind: "redirect"; childId: string }
  | { kind: "confirm"; match: DuplicateChildMatch };

export function decideDuplicateWarning(
  matches: DuplicateChildMatch[]
): DuplicateWarningDecision {
  const selfMatch = matches.find(m => m.createdByIsSelf);
  if (selfMatch) {
    return { kind: "redirect", childId: selfMatch.id };
  }
  if (matches.length > 0) {
    return { kind: "confirm", match: matches[0] };
  }
  return { kind: "none" };
}
