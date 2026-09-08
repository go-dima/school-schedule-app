import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Child } from "../types";
import { GroupTrackSelect } from "./GroupTrackSelect";

interface ChildTrackSelectorProps {
  child: Child | undefined;
  onChange: (trackNumber: number | null) => Promise<void>;
  disabled?: boolean;
  style?: React.CSSProperties;
}

// Track (מסלול) is only meaningful for grades 3-6 by convention -- grades 1-2 use
// Group instead. The convention isn't enforced anywhere else in the schema/UI, so
// this is purely about not showing an irrelevant control here.
const TRACK_GRADES = [3, 4, 5, 6];

export function ChildTrackSelector({
  child,
  onChange,
  disabled = false,
  style,
}: ChildTrackSelectorProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  if (!child || !TRACK_GRADES.includes(child.grade)) {
    return null;
  }

  const handleChange = async (value: number | undefined) => {
    setSaving(true);
    try {
      await onChange(value ?? null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GroupTrackSelect
      value={child.trackNumber}
      onChange={handleChange}
      optionLabel={track => t("schedule.page.labels.trackOption", { track })}
      placeholder={t("schedule.page.labels.trackPlaceholder")}
      disabled={disabled || saving}
      loading={saving}
      style={style}
    />
  );
}
