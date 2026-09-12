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
A Child and Class attribute with value 1, 2, or none. When a Child's Group matches a Class's Group (and the Class's grade matches the Child's grade), the Class is auto-assigned to the Child's schedule as a Locked Selection. Convention: used for grades 1–2, alongside Mandatory — both attributes exist on every Class and Child regardless of grade, and neither the grade convention nor the Group/Mandatory pairing is enforced by the schema. Hebrew label: קבוצה.
_Avoid_: Track, Cohort for this attribute — Group and Track are two distinct, independently-set attributes; do not conflate them.

**Track**:
A Child and Class attribute with value 1, 2, or none, matched the same way as Group (to produce a Locked Selection) but tracked independently of it — a Class or Child can carry a Group, a Track, both, or neither. Convention: used for grades 3–6, in place of Group. Hebrew label: מסלול.
_Avoid_: Group, Cohort — kept distinct from Group even though both follow the same 1/2/none shape and matching mechanism.

**Mandatory**:
A Class attribute meaning a Child cannot unset it once selected, producing a Locked Selection. Used mainly for grades 1–2.

**Locked Selection**:
A Selection the Child cannot remove. Produced by Mandatory, a Group match, or a Track match. All three triggers are implemented: Track locking lives in `SchedulePage`'s track-change sync flow; Mandatory and Group share a single auto-assign-and-lock mechanism (`GroupMandatoryLockService`), synced whenever the active child's schedule is viewed.

**Selection**:
A Class a Child has chosen for their schedule. Free by default; a Locked Selection is the exception.
