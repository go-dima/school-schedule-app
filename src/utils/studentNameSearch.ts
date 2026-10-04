interface StudentName {
  firstName: string;
  lastName: string;
}

/**
 * Case-insensitive substring match on a student's first name, last name, or
 * "first last" full name. An empty search matches everyone. Grade and other
 * fields are deliberately not considered.
 */
export const matchesStudentName = (
  student: StudentName,
  searchTerm: string
): boolean => {
  if (!searchTerm) return true;

  const search = searchTerm.toLowerCase();
  const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
  return (
    fullName.includes(search) ||
    student.firstName.toLowerCase().includes(search) ||
    student.lastName.toLowerCase().includes(search)
  );
};

/** Keeps the students matching `searchTerm`, in their original order. */
export const filterByStudentName = <T extends StudentName>(
  students: T[],
  searchTerm: string
): T[] => students.filter(student => matchesStudentName(student, searchTerm));
