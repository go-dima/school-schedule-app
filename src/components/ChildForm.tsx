import { Form, Input, Select, Button, Space, message } from "antd";
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
      message.success(isEditing ? "הילד עודכן בהצלחה" : "הילד נוסף בהצלחה");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "שגיאה בשמירת פרטי הילד"
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
        label="שם פרטי"
        name="firstName"
        rules={[{ required: true, message: "נא להזין שם פרטי" }]}>
        <Input placeholder="הזן שם פרטי" />
      </Form.Item>

      <Form.Item
        label="שם משפחה"
        name="lastName"
        rules={[{ required: true, message: "נא להזין שם משפחה" }]}>
        <Input placeholder="הזן שם משפחה" />
      </Form.Item>

      <Form.Item
        label="כיתה"
        name="grade"
        rules={[{ required: true, message: "נא לבחור כיתה" }]}>
        <Select placeholder="בחר כיתה">
          {GRADES.map(grade => (
            <Select.Option key={grade} value={grade}>
              {GetGradeName(grade)}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        label="קבוצה"
        name="groupNumber"
        rules={[{ required: true, message: "נא לבחור קבוצה" }]}>
        <Select placeholder="בחר קבוצה">
          <Select.Option value={1}>קבוצה 1</Select.Option>
          <Select.Option value={2}>קבוצה 2</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing ? "עדכן" : "הוסף"}
          </Button>
          <Button onClick={onCancel}>ביטול</Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
