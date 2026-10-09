import React from "react";
import { Empty, Form, Input, Segmented, Select, Space } from "antd";
import { useTranslation } from "react-i18next";
import { GRADES, type Child } from "../types";
import { GetGradeName } from "../utils/grades";
import { GroupTrackSelect } from "./GroupTrackSelect";
import type {
  ChildLinkDraft,
  ChildLinkMode,
  ChildLinkNewChild,
} from "./childAccountLink";
import "./ChildAccountLinkPicker.css";

interface ChildAccountLinkPickerProps {
  /** Students with no linked account yet; the caller does the filtering. */
  students: Child[];
  value: ChildLinkDraft;
  onChange: (value: ChildLinkDraft) => void;
  loading?: boolean;
  disabled?: boolean;
}

// Picks the student record a child login is linked to at approval: an
// existing student, or a new one. Presentational only, so the approval modal
// (PendingApprovals) and the role modal (User Management) can share it.
// ChildForm isn't embedded because it saves through the API itself and has
// its own buttons; the new-student fields reuse its labels (form.child.*).
export const ChildAccountLinkPicker: React.FC<ChildAccountLinkPickerProps> = ({
  students,
  value,
  onChange,
  loading = false,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const setNewChild = (patch: Partial<ChildLinkNewChild>) =>
    onChange({ ...value, newChild: { ...value.newChild, ...patch } });

  return (
    <Space
      direction="vertical"
      size="middle"
      className="child-account-link-picker">
      <Segmented<ChildLinkMode>
        block
        disabled={disabled}
        value={value.mode}
        onChange={mode => onChange({ ...value, mode })}
        options={[
          {
            value: "existing",
            label: t("pendingApprovals.childLink.modeExisting"),
          },
          { value: "new", label: t("pendingApprovals.childLink.modeNew") },
        ]}
      />

      {value.mode === "existing" ? (
        <Form layout="vertical" component="div">
          <Form.Item
            label={t("pendingApprovals.childLink.studentLabel")}
            className="child-account-link-picker__last-field">
            <Select
              showSearch
              allowClear
              disabled={disabled}
              loading={loading}
              value={value.childId}
              onChange={childId => onChange({ ...value, childId })}
              placeholder={t("pendingApprovals.childLink.studentPlaceholder")}
              optionFilterProp="label"
              notFoundContent={
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t("pendingApprovals.childLink.noUnlinked")}
                />
              }
              options={students.map(child => ({
                value: child.id,
                label: `${child.firstName} ${child.lastName} · ${GetGradeName(child.grade)}`,
              }))}
            />
          </Form.Item>
        </Form>
      ) : (
        <Form layout="vertical" component="div" disabled={disabled}>
          <Form.Item label={t("form.child.firstNameLabel")}>
            <Input
              value={value.newChild.firstName}
              onChange={e => setNewChild({ firstName: e.target.value })}
              placeholder={t("form.child.firstNamePlaceholder")}
            />
          </Form.Item>
          <Form.Item label={t("form.child.lastNameLabel")}>
            <Input
              value={value.newChild.lastName}
              onChange={e => setNewChild({ lastName: e.target.value })}
              placeholder={t("form.child.lastNamePlaceholder")}
            />
          </Form.Item>
          <Form.Item label={t("form.child.gradeLabel")}>
            <Select
              value={value.newChild.grade}
              onChange={grade => setNewChild({ grade })}
              placeholder={t("form.child.gradePlaceholder")}
              options={GRADES.map(grade => ({
                value: grade,
                label: GetGradeName(grade),
              }))}
            />
          </Form.Item>
          <Form.Item
            label={t("form.child.groupLabel")}
            className="child-account-link-picker__last-field">
            <GroupTrackSelect
              value={value.newChild.groupNumber}
              onChange={groupNumber =>
                setNewChild({ groupNumber: groupNumber ?? null })
              }
              optionLabel={group => t("form.child.groupOption", { group })}
              placeholder={t("form.child.groupPlaceholder")}
              className="child-account-link-picker__group-track"
            />
          </Form.Item>
        </Form>
      )}
    </Space>
  );
};
