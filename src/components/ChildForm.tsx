import { Form, Input, Select, Button, Space, message, Modal } from "antd";
import { useTranslation } from "react-i18next";
import type { Child, Scope } from "../types";
import { GRADES } from "../types";
import { GetGradeName } from "@/utils/grades";
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
}

export function ChildForm({
  child,
  onSubmit,
  onCancel,
  loading = false,
  showScope = true,
  onDuplicateRedirect,
}: ChildFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form] = Form.useForm();
  const isEditing = !!child;

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

  const handleSubmit = async (values: any) => {
    if (!user?.id) {
      await submitChild(values);
      return;
    }

    const matches = await childrenApi.findLocalDuplicateChildren(
      values.firstName,
      values.lastName,
      values.grade,
      child?.id,
      user.id
    );
    const decision = decideDuplicateWarning(matches);

    if (decision.kind === "redirect") {
      Modal.info({
        title: t("child.duplicateWarning.title"),
        content: t("child.duplicateWarning.sameCreatorMessage"),
        okText: t("child.duplicateWarning.goToEdit"),
        onOk: () => onDuplicateRedirect?.(decision.childId),
      });
      return;
    }

    if (decision.kind === "confirm") {
      Modal.confirm({
        title: t("child.duplicateWarning.title"),
        content: t("child.duplicateWarning.existsMessage", {
          name: `${values.firstName} ${values.lastName}`,
          creator: decision.match.createdByName ?? "",
          grade: decision.match.grade,
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
    </Form>
  );
}
