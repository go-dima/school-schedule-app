import { useEffect } from "react";
import { Form, Input, Select, Button, Space, message } from "antd";
import { useTranslation } from "react-i18next";
import type { Child, Scope } from "../types";
import { GRADES } from "../types";
import { GetGradeName } from "@/utils/grades";
import { ScopeSelector } from "./ScopeSelector";
import { GroupTrackSelect } from "./GroupTrackSelect";

interface ChildFormProps {
  child?: Child;
  /**
   * When editing an existing child in a parent-facing context, Track is
   * shown read-only, sourced from the committed value rather than the
   * child's (draft) trackNumber -- a parent's own draft experimentation
   * happens on the Schedule page's track selector, not here. Ignored when
   * creating a new child (trackNumber there is still an editable initial
   * draft pick) or in a staff/admin context (Track stays editable there,
   * already committed-sourced by the caller's child prop).
   */
  committedTrackNumber?: number | null;
  trackNumberReadOnly?: boolean;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number | null;
    trackNumber?: number | null;
    scope?: Scope;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ChildForm({
  child,
  committedTrackNumber,
  trackNumberReadOnly = false,
  onSubmit,
  onCancel,
  loading = false,
}: ChildFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEditing = !!child;
  const showReadOnlyTrack = trackNumberReadOnly && isEditing;

  // Form.initialValues only applies once at mount; committedTrackNumber
  // arrives asynchronously after the form is already mounted (fetched once
  // the edit modal opens), so it needs to be pushed in explicitly once it's
  // available rather than relying on initialValues to pick it up.
  useEffect(() => {
    if (showReadOnlyTrack) {
      form.setFieldValue("trackNumber", committedTrackNumber ?? null);
    }
  }, [showReadOnlyTrack, committedTrackNumber, form]);

  const handleSubmit = async (values: any) => {
    try {
      await onSubmit({
        firstName: values.firstName,
        lastName: values.lastName,
        grade: values.grade,
        groupNumber: values.groupNumber ?? null,
        // Read-only track is a display of the committed value, never part
        // of what this form edits -- omit it so the parent-owned draft
        // track is never touched by submitting this form.
        trackNumber: showReadOnlyTrack
          ? undefined
          : (values.trackNumber ?? null),
        scope: values.scope,
      });
      message.success(
        isEditing ? t("form.child.updateSuccess") : t("form.child.addSuccess")
      );
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : t("form.child.saveError")
      );
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        firstName: child?.firstName || "",
        lastName: child?.lastName || "",
        grade: child?.grade || 1,
        groupNumber: child?.groupNumber ?? null,
        trackNumber: showReadOnlyTrack
          ? (committedTrackNumber ?? null)
          : (child?.trackNumber ?? null),
        scope: child?.scope || "prod",
      }}>
      <Form.Item
        label={t("form.child.firstNameLabel")}
        name="firstName"
        rules={[
          { required: true, message: t("form.child.firstNameRequired") },
        ]}>
        <Input placeholder={t("form.child.firstNamePlaceholder")} />
      </Form.Item>

      <Form.Item
        label={t("form.child.lastNameLabel")}
        name="lastName"
        rules={[{ required: true, message: t("form.child.lastNameRequired") }]}>
        <Input placeholder={t("form.child.lastNamePlaceholder")} />
      </Form.Item>

      <Form.Item
        label={t("form.child.gradeLabel")}
        name="grade"
        rules={[{ required: true, message: t("form.child.gradeRequired") }]}>
        <Select placeholder={t("form.child.gradePlaceholder")}>
          {GRADES.map(grade => (
            <Select.Option key={grade} value={grade}>
              {GetGradeName(grade)}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item label={t("form.child.groupLabel")} name="groupNumber">
        <GroupTrackSelect
          optionLabel={group => t("form.child.groupOption", { group })}
          placeholder={t("form.child.groupPlaceholder")}
        />
      </Form.Item>

      <Form.Item
        label={t("form.child.trackLabel")}
        name="trackNumber"
        extra={
          showReadOnlyTrack ? t("form.child.trackReadOnlyHint") : undefined
        }>
        <GroupTrackSelect
          optionLabel={track => t("form.child.trackOption", { track })}
          placeholder={t("form.child.trackPlaceholder")}
          disabled={showReadOnlyTrack}
        />
      </Form.Item>

      <ScopeSelector />

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing
              ? t("form.child.updateButton")
              : t("form.child.addButton")}
          </Button>
          <Button onClick={onCancel}>{t("common.buttons.cancel")}</Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
