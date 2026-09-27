/**
 * How a user is named in the UI ("created by", "added by"): their Display
 * Name when they have one, else first + last name, else null -- callers add
 * their own last fallback (email, "unknown").
 */
export function formatPersonName(person: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string | null {
  const displayName = person.displayName?.trim();
  if (displayName) return displayName;
  return (
    [person.firstName, person.lastName]
      .map(part => part?.trim())
      .filter(Boolean)
      .join(" ") || null
  );
}
