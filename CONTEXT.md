# School Schedule

Elementary school (grades 1–6) weekly class scheduling. Children select from classes laid out on a Sunday–Thursday grid of Time Slots; some classes are assigned to a child automatically rather than chosen freely.

## Language

**Time Slot**:
A time-of-day period (e.g. 08:00–08:45), independent of day.

**Class Slot**:
A (Day, Time Slot) pair occupied by a Class. A Class has one or more Class Slots; most have one, some have several.

**Double Lesson**:
A Class attribute (`is_double`) meaning the Class occupies two sequential Class Slots on the same day. Set via a dedicated form toggle that auto-fills the second slot; a Class can also carry additional, non-sequential Class Slots added manually alongside or instead of this.

**Group**:
A Child and Class attribute with value 1, 2, or none. When a Child's Group matches a Class's Group (and the Class's grade matches the Child's grade), the Class is auto-assigned to the Child's schedule as a Locked Selection. Currently used mainly for grades above 2, while grades 1–2 rely on Mandatory instead — both attributes exist on every Class regardless of grade, and this split is a current convention, not a schema rule.
_Avoid_: Track, Cohort — "Group" is the term used throughout the schema and code.

**Mandatory**:
A Class attribute meaning a Child cannot unset it once selected, producing a Locked Selection. Used mainly for grades 1–2.

**Locked Selection**:
A Selection the Child cannot remove. Produced by either Mandatory or a Group match — one mechanism, two triggers.

**Selection**:
A Class a Child has chosen for their schedule. Free by default; a Locked Selection is the exception.
