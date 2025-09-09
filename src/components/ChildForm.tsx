import { Form, Input, Select, Button, Space, message } from "antd";
import { useTranslation } from "react-i18next";
import type { Child } from "../types";
import { GRADES } from "../types";
import { GetGradeName } from "@/utils/grades";

interface ChildFormProps {
  child?: Child;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ChildForm({
  child,
  onSubmit,
  onCancel,
  loading = false,
}: ChildFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEditing = !!child;

  const handleSubmit = async (values: any) => {
    try {
      await onSubmit({
        firstName: values.firstName,
        lastName: values.lastName,
        grade: values.grade,
        groupNumber: values.groupNumber,
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
        groupNumber: child?.groupNumber || 1,
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

      <Form.Item
        label={t("form.child.groupLabel")}
        name="groupNumber"
        rules={[{ required: true, message: t("form.child.groupRequired") }]}>
        <Select placeholder={t("form.child.groupPlaceholder")}>
          <Select.Option value={1}>{t("form.child.group1")}</Select.Option>
          <Select.Option value={2}>{t("form.child.group2")}</Select.Option>
        </Select>
      </Form.Item>

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
