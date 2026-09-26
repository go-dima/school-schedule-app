import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Form, Typography } from "antd";
import { TeacherPicker } from "../components/TeacherPicker";
import type { StaffMember } from "../services/staffScheduleService";

const MEMBERS: StaffMember[] = [
  {
    key: { kind: "user", id: "user-1" },
    label: "טלוש שור",
    teaches: true,
  },
  {
    key: { kind: "user", id: "user-2" },
    label: "רחל פלדפוגל",
    teaches: true,
  },
  {
    key: { kind: "name", name: "רם ז'אן" },
    label: "רם ז'אן",
    teaches: true,
  },
];

// Inside a Form.Item, as in ClassForm / ScheduleOverrideForm, with the
// current field value echoed below so free text can be checked.
const InForm = (args: { members: StaffMember[] }) => {
  const [form] = Form.useForm();
  const [value, setValue] = useState<string | undefined>();
  return (
    <Form
      form={form}
      layout="vertical"
      style={{ maxWidth: 320 }}
      onValuesChange={(_, all) => setValue(all.teacher)}>
      <Form.Item name="teacher" label="מורה">
        <TeacherPicker members={args.members} placeholder="שם המורה" />
      </Form.Item>
      <Typography.Text data-testid="teacher-value">
        {`value: ${value ?? ""}`}
      </Typography.Text>
    </Form>
  );
};

const meta: Meta<typeof InForm> = {
  title: "Components/TeacherPicker",
  component: InForm,
  parameters: { layout: "padded" },
  args: { members: MEMBERS },
};

export default meta;
type Story = StoryObj<typeof InForm>;

export const WithStaff: Story = {};

export const NoStaffLoaded: Story = {
  args: { members: [] },
};
