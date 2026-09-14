import { useState } from "react";
import { Form, Input, Select, Button, Space, message, Modal } from "antd";
import { useTranslation } from "react-i18next";
import type { Child, DuplicateChildMatch, Scope } from "../types";
import { GRADES } from "../types";
import { GetGradeName, GetGradeNameShort } from "@/utils/grades";
import { ScopeSelector } from "./ScopeSelector";
import { GroupTrackSelect } from "./GroupTrackSelect";
import { useAuth } from "../contexts/AuthContext";
import { childrenApi } from "../services/api";
import { decideDuplicateWarning } from "./childDuplicateWarning";

interface ChildFormProps {
  child?: Child;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number | null;
    scope?: Scope;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  showScope?: boolean;
  onDuplicateRedirect?: (childId: string) => void;
  canNavigateToEdit?: boolean;
}

export function ChildForm({
  child,
  onSubmit,
  onCancel,
  loading = false,
  showScope = true,
  onDuplicateRedirect,
  canNavigateToEdit = false,
}: ChildFormProps) {
  const { t } = useTranslation();
  const { user, hasRole } = useAuth();
  const [form] = Form.useForm();
  const isEditing = !!child;
  const [duplicateDialog, setDuplicateDialog] = useState<{
    values: any;
    match: DuplicateChildMatch;
  } | null>(null);
  const [attaching, setAttaching] = useState(false);

  const submitChild = async (values: any) => {
    try {
      await onSubmit({
        firstName: values.firstName,
        lastName: values.lastName,
        grade: values.grade,
        groupNumber: values.groupNumber ?? null,
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

  const handleAttachExisting = async () => {
    if (!duplicateDialog) return;
    setAttaching(true);
    try {
      await childrenApi.claimChild(duplicateDialog.match.id);
      message.success(t("child.duplicateWarning.attachSuccess"));
      setDuplicateDialog(null);
      window.location.reload();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : t("form.child.saveError")
      );
    } finally {
      setAttaching(false);
    }
  };

  const handleAddNewInstead = async () => {
    if (!duplicateDialog) return;
    const { values } = duplicateDialog;
    setDuplicateDialog(null);
    await submitChild(values);
  };

  const handleSubmit = async (values: any) => {
    if (!user?.id) {
      await submitChild(values);
      return;
    }

    let matches;
    try {
      matches = await childrenApi.findLocalDuplicateChildren(
        values.firstName,
        values.lastName,
        values.grade,
        child?.id,
        user.id
      );
    } catch (error) {
      console.error("Failed to check for duplicate children:", error);
      await submitChild(values);
      return;
    }
    const decision = decideDuplicateWarning(matches);

    if (decision.kind === "redirect") {
      Modal.info({
        title: t("child.duplicateWarning.title"),
        content: t("child.duplicateWarning.sameCreatorMessage"),
        okText: canNavigateToEdit
          ? t("child.duplicateWarning.goToEdit")
          : t("common.ok"),
        onOk: () => onDuplicateRedirect?.(decision.childId),
      });
      return;
    }

    if (decision.kind === "confirm") {
      // An approved parent can attach themselves to the existing (unclaimed)
      // child instead of creating a duplicate -- offer that as the primary
      // action. Staff/admin can't claim (claim_child rejects non-parents),
      // so they only get the create-anyway/cancel choice.
      if (hasRole("parent")) {
        setDuplicateDialog({ values, match: decision.match });
        return;
      }

      Modal.confirm({
        title: t("child.duplicateWarning.title"),
        content: t("child.duplicateWarning.existsMessage", {
          name: `${values.firstName} ${values.lastName}`,
          creator:
            decision.match.createdByName ??
            t("child.duplicateWarning.unknownCreator"),
          grade: GetGradeNameShort(decision.match.grade),
        }),
        okText: t("child.duplicateWarning.continueAnyway"),
        cancelText: t("child.duplicateWarning.cancel"),
        onOk: () => submitChild(values),
      });
      return;
    }

    await submitChild(values);
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

      {showScope && <ScopeSelector />}

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

      {duplicateDialog && (
        <Modal
          open
          title={t("child.duplicateWarning.title")}
          onCancel={() => setDuplicateDialog(null)}
          footer={[
            <Button key="cancel" onClick={() => setDuplicateDialog(null)}>
              {t("child.duplicateWarning.cancel")}
            </Button>,
            <Button key="addNew" onClick={handleAddNewInstead}>
              {t("child.duplicateWarning.addNewChild")}
            </Button>,
            <Button
              key="attach"
              type="primary"
              loading={attaching}
              onClick={handleAttachExisting}>
              {t("child.duplicateWarning.attachExisting")}
            </Button>,
          ]}>
          {t("child.duplicateWarning.existsMessage", {
            name: `${duplicateDialog.values.firstName} ${duplicateDialog.values.lastName}`,
            creator:
              duplicateDialog.match.createdByName ??
              t("child.duplicateWarning.unknownCreator"),
            grade: GetGradeNameShort(duplicateDialog.match.grade),
          })}
        </Modal>
      )}
    </Form>
  );
}
