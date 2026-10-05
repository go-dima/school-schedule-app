/**
 * The one matching rule for every closed-list search (people's names, class
 * titles): trim the query, then a case-insensitive substring match. An empty
 * (or all-space) query matches everything.
 */
export const matchesText = (text: string, query: string): boolean => {
  const search = query.trim().toLowerCase();
  if (!search) return true;
  return text.toLowerCase().includes(search);
};

/** Keeps the items whose text matches `query`, in their original order. */
export const filterByText = <T>(
  items: T[],
  query: string,
  getText: (item: T) => string
): T[] => items.filter(item => matchesText(getText(item), query));
