import React from "react";
import { Alert, Button, Form, Input, Modal, Select, Space } from "antd";
import { useTranslation } from "react-i18next";
import { ScheduleService } from "../services/scheduleService";
import type {
  ScheduleOverride,
  ScheduleOverrideWithTimeSlot,
  TimeSlot,
} from "../types";
import { DAYS_OF_WEEK } from "../types";
import { ScopeSelector } from "./ScopeSelector";

const { Option } = Select;

export interface ScheduleOverrideFormValues {
  title: string;
  teacher: string;
  room: string;
  dayOfWeek: number;
  timeSlotId: string;
  scope: ScheduleOverride["scope"];
}

interface ScheduleOverrideFormProps {
  initialValues?: ScheduleOverrideWithTimeSlot | null;
  timeSlots: TimeSlot[];
  onSubmit: (values: ScheduleOverrideFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  loading?: boolean;
  isEdit?: boolean;
}

const ScheduleOverrideForm: React.FC<ScheduleOverrideFormProps> = ({
  initialValues,
  timeSlots,
  onSubmit,
  onCancel,
  onDelete,
  loading = false,
  isEdit = false,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // Unlike ClassForm, an override can target any slot -- including
  // breaks/meetings (staff can override those too) -- so this must not
  // filter down to getLessonTimeSlots. Doing so would drop a pre-filled
  // fixed-slot id from the option list entirely, and antd's Select falls
  // back to rendering the raw id as text when it can't find a matching
  // option to source a label from.
  const availableTimeSlots = timeSlots;

  const handleSubmit = async (values: ScheduleOverrideFormValues) => {
    await onSubmit({
      title: values.title,
      teacher: values.teacher,
      room: values.room || "",
      dayOfWeek: values.dayOfWeek,
      timeSlotId: values.timeSlotId,
      scope: values.scope || "prod",
    });
  };

  const handleDelete = () => {
    if (!onDelete) return;
    Modal.confirm({
      title: t("schedule.override.deleteConfirmTitle"),
      content: t("schedule.override.deleteConfirmDescription"),
      okText: t("schedule.override.confirmDelete"),
      cancelText: t("schedule.override.confirmCancel"),
      okButtonProps: { danger: true },
      onOk: onDelete,
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={
        initialValues
          ? {
              title: initialValues.title,
              teacher: initialValues.teacher,
              room: initialValues.room,
              dayOfWeek: initialValues.dayOfWeek,
              timeSlotId: initialValues.timeSlotId,
              scope: initialValues.scope,
            }
          : {
              scope: "prod",
            }
      }>
      <Alert
        type="warning"
        showIcon
        message={t("schedule.override.warningAlert")}
        style={{ marginBottom: 16 }}
      />

      <Form.Item
        name="title"
        label={t("schedule.override.titleLabel")}
        rules={[
          { required: true, message: t("schedule.override.titleRequired") },
        ]}>
        <Input placeholder={t("schedule.override.titlePlaceholder")} />
      </Form.Item>

      <Form.Item
        name="teacher"
        label={t("schedule.override.teacherLabel")}
        rules={[
          { required: true, message: t("schedule.override.teacherRequired") },
        ]}>
        <Input placeholder={t("schedule.override.teacherPlaceholder")} />
      </Form.Item>

      <Form.Item name="room" label={t("schedule.override.roomLabel")}>
        <Input placeholder={t("schedule.override.roomPlaceholder")} />
      </Form.Item>

      <Form.Item
        name="dayOfWeek"
        label={t("schedule.override.dayLabel")}
        rules={[
          { required: true, message: t("schedule.override.dayRequired") },
        ]}>
        <Select placeholder={t("schedule.override.dayPlaceholder")}>
          {DAYS_OF_WEEK.map(day => (
            <Option key={day.key} value={day.key}>
              {day.name}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="timeSlotId"
        label={t("schedule.override.timeLabel")}
        rules={[
          { required: true, message: t("schedule.override.timeRequired") },
        ]}>
        <Select
          placeholder={t("schedule.override.timePlaceholder")}
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) =>
            (option?.children as unknown as string)
              ?.toLowerCase()
              .includes(input.toLowerCase())
          }>
          {[...availableTimeSlots]
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(slot => (
              <Option key={slot.id} value={slot.id}>
                {slot.name} -{" "}
                {ScheduleService.formatTimeRange(slot.startTime, slot.endTime)}
              </Option>
            ))}
        </Select>
      </Form.Item>

      <ScopeSelector
        value={form.getFieldValue("scope")}
        onChange={value => form.setFieldValue("scope", value)}
      />

      <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEdit
              ? t("schedule.override.updateButton")
              : t("schedule.override.createButton")}
          </Button>
          <Button onClick={onCancel}>{t("common.buttons.cancel")}</Button>
          {isEdit && onDelete && (
            <Button danger onClick={handleDelete}>
              {t("schedule.override.deleteButton")}
            </Button>
          )}
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ScheduleOverrideForm;
