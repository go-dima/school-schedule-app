import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Child } from "../types";
import { GroupTrackSelect } from "./GroupTrackSelect";

export type SelectionField = "groupNumber" | "trackNumber";

interface ChildGroupTrackSelectorProps {
  child: Child | undefined;
  onChange: (field: SelectionField, value: number | null) => Promise<void>;
  disabled?: boolean;
  style?: React.CSSProperties;
}

// Group (קבוצה) is grades 1-2; Track (מסלול) is grades 3-6, by
// convention -- the two are mutually exclusive per child grade. Not
// enforced anywhere else in the schema/UI, so this is purely about not
// showing an irrelevant control.
const GROUP_GRADES = [1, 2];
const TRACK_GRADES = [3, 4, 5, 6];

export function ChildGroupTrackSelector({
  child,
  onChange,
  disabled = false,
  style,
}: ChildGroupTrackSelectorProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const field: SelectionField | undefined = !child
    ? undefined
    : GROUP_GRADES.includes(child.grade)
      ? "groupNumber"
      : TRACK_GRADES.includes(child.grade)
        ? "trackNumber"
        : undefined;

  if (!child || !field) {
    return null;
  }

  const value = field === "groupNumber" ? child.groupNumber : child.trackNumber;
  const optionLabel =
    field === "groupNumber"
      ? (group: number) => t("schedule.page.labels.groupOption", { group })
      : (track: number) => t("schedule.page.labels.trackOption", { track });
  const placeholder = t(
    field === "groupNumber"
      ? "schedule.page.labels.groupPlaceholder"
      : "schedule.page.labels.trackPlaceholder"
  );

  const handleChange = async (newValue: number | undefined) => {
    setSaving(true);
    try {
      await onChange(field, newValue ?? null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GroupTrackSelect
      value={value}
      onChange={handleChange}
      optionLabel={optionLabel}
      placeholder={placeholder}
      disabled={disabled || saving}
      loading={saving}
      style={style}
    />
  );
}
