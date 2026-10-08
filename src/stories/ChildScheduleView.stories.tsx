import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AutoComplete, Button, Radio } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import ScheduleTable from "../components/ScheduleTable";
import { FiltersBar } from "../components/FiltersBar";
import { FilterField } from "../components/FilterField";
import { ChildGroupTrackSelector } from "../components/ChildGroupTrackSelector";
import type { Child } from "../types";
import { DAYS_OF_WEEK } from "../types";
import i18n from "../utils/i18n";
import {
  buildUserSelections,
  mockClasses,
  mockOverrides,
  mockTimeSlots,
  mockWeeklySchedule,
} from "./fixtures/scheduleFixtures";
import "../pages/schedule/SchedulePage.css";

const t = i18n.t.bind(i18n);

// SchedulePage reads the Auth, Child and AllChildren contexts plus several
// data hooks and APIs, so it can't render here without Supabase. This story
// composes the pieces a logged-in child user sees instead: the filters bar
// (class search, their own track, draft/committed toggle, print) over the
// schedule table for their grade. What's deliberately absent is the point:
// no staff/student tab bar, no child tabs, no "add child" button, no grade
// filter.

const linkedStudent: Child = {
  id: "me",
  firstName: "איתי",
  lastName: "כהן",
  grade: 4,
  groupNumber: null,
  trackNumber: 1,
  scope: "test",
  createdBy: null,
  createdByName: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

// One non-mandatory grade-4 pick per day, as a draft would have.
const pickedIds = DAYS_OF_WEEK.map(
  day =>
    mockClasses.find(
      cls =>
        cls.slots[0]?.dayOfWeek === day.key &&
        !cls.isMandatory &&
        cls.grades.includes(linkedStudent.grade)
    )?.id
).filter((id): id is string => Boolean(id));

function ChildScheduleViewDemo({
  committed = false,
  grade = linkedStudent.grade,
}: {
  committed?: boolean;
  grade?: number;
}) {
  const [student, setStudent] = useState({
    ...linkedStudent,
    grade,
    groupNumber: grade <= 2 ? 1 : null,
  });
  const [viewCommitted, setViewCommitted] = useState(committed);
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div style={{ padding: 16 }}>
      <FiltersBar
        variant="flat"
        canRefresh
        actions={
          <>
            <Button icon={<PrinterOutlined />}>
              {t("schedule.page.exportButtonFor", {
                name: `${student.firstName} ${student.lastName}`,
              })}
            </Button>
            <Radio.Group
              className="draft-committed-toggle"
              optionType="button"
              value={viewCommitted ? "committed" : "draft"}
              onChange={e => setViewCommitted(e.target.value === "committed")}>
              <Radio.Button value="draft">
                {t("schedule.page.labels.draftView")}
              </Radio.Button>
              <Radio.Button value="committed">
                {t("schedule.page.labels.committedView")}
              </Radio.Button>
            </Radio.Group>
          </>
        }>
        <FilterField label={t("schedule.page.labels.searchClass")}>
          <AutoComplete
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("schedule.page.placeholders.searchClass")}
            style={{ minWidth: 200 }}
            allowClear
          />
        </FilterField>
        <ChildGroupTrackSelector
          child={student}
          disabled={viewCommitted}
          canEditGroup={false}
          onChange={async (field, value) =>
            setStudent(prev => ({ ...prev, [field]: value }))
          }
        />
      </FiltersBar>

      <ScheduleTable
        timeSlots={mockTimeSlots}
        classes={mockClasses}
        weeklySchedule={mockWeeklySchedule}
        userGrade={student.grade}
        selectedClasses={pickedIds}
        draftPickedClassIds={viewCommitted ? [] : pickedIds}
        userSelections={buildUserSelections(pickedIds)}
        canSelectClasses={!viewCommitted}
        canViewClasses
        showEnrollmentCount
        searchTerm={searchTerm}
        overrides={viewCommitted ? mockOverrides : undefined}
      />
    </div>
  );
}

const meta: Meta = {
  title: "Pages/SchedulePage/ChildView",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

// Draft view: the child picks classes for themself.
export const Draft: Story = {
  render: () => <ChildScheduleViewDemo />,
};

// Committed view: read-only, with staff overrides shown.
export const Committed: Story = {
  render: () => <ChildScheduleViewDemo committed />,
};

// Grades 1-2: the group is shown but read-only (staff or a parent sets it).
export const GroupReadOnly: Story = {
  render: () => <ChildScheduleViewDemo grade={2} />,
};
