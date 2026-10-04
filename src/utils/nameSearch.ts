/**
 * The one matching rule for every person-name search (students, staff,
 * teachers, users): trim the query, then a case-insensitive substring match.
 * An empty (or all-space) query matches everyone.
 */
export const matchesName = (name: string, query: string): boolean => {
  const search = query.trim().toLowerCase();
  if (!search) return true;
  return name.toLowerCase().includes(search);
};

/** Keeps the items whose name matches `query`, in their original order. */
export const filterByName = <T>(
  items: T[],
  query: string,
  getName: (item: T) => string
): T[] => items.filter(item => matchesName(getName(item), query));
