import React, { useState, useEffect } from "react";
import { Form, Input, Select, Button, Space, Switch, Row, Col } from "antd";
import { useTranslation } from "react-i18next";
import { ScheduleService } from "../services/scheduleService";
import { getLessonTimeSlots } from "../utils/timeSlots";
import type { ClassWithTimeSlot, TimeSlot, Class } from "../types";
import { GRADES, DAYS_OF_WEEK } from "../types";
import { GetGradeName } from "@/utils/grades";

const { TextArea } = Input;
const { Option } = Select;

interface ClassFormProps {
  initialValues?: ClassWithTimeSlot | null;
  timeSlots: TimeSlot[];
  onSubmit: (
    values: Omit<Class, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isNewLesson?: boolean;
}

const ClassForm: React.FC<ClassFormProps> = ({
  initialValues,
  timeSlots,
  onSubmit,
  onCancel,
  loading = false,
  isNewLesson = true,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [selectedDay, setSelectedDay] = useState<number | undefined>(undefined);

  // Filter to only show lesson time slots (not breaks or meetings)
  const lessonTimeSlots = getLessonTimeSlots(timeSlots);

  // Time slots are now day-independent, so we can use them directly
  const availableTimeSlots = lessonTimeSlots;

  // Initialize form values and set initial day
  useEffect(() => {
    if (initialValues) {
      setSelectedDay(initialValues.dayOfWeek);
    }
  }, [initialValues]);

  // Watch for dayOfWeek field changes from form and update selectedDay
  const dayOfWeekValue = Form.useWatch("dayOfWeek", form);

  useEffect(() => {
    if (dayOfWeekValue !== undefined) {
      setSelectedDay(dayOfWeekValue);
    }
  }, [dayOfWeekValue]);

  const handleSubmit = async (values: any) => {
    try {
      const classData: Omit<Class, "id" | "createdAt" | "updatedAt"> = {
        title: values.title,
        description: values.description || "",
        teacher: values.teacher,
        dayOfWeek: values.dayOfWeek,
        timeSlotId: values.timeSlotId,
        grades: values.grades || [],
        isMandatory: values.isMandatory || false,
        isDouble: values.isDouble || false,
        room: values.room || "",
        scope: values.scope || "test",
      };

      await onSubmit(classData);
    } catch (error) {
      console.error("ClassForm submission error:", error);
      throw error; // Re-throw to let parent handle
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onFinishFailed={errorInfo => {
        console.error("Form validation failed:", errorInfo);
      }}
      initialValues={
        initialValues
          ? {
              title: initialValues.title,
              description: initialValues.description,
              teacher: initialValues.teacher,
              dayOfWeek: initialValues.dayOfWeek,
              timeSlotId: initialValues.timeSlotId,
              grades: initialValues.grades || [],
              isMandatory: initialValues.isMandatory,
              isDouble: initialValues.isDouble,
              room: initialValues.room,
              scope: initialValues.scope,
            }
          : {
              description: "",
              isMandatory: false,
              isDouble: false,
              room: "",
              scope: "test",
            }
      }>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="title"
            label={t("form.class.nameLabel")}
            rules={[
              { required: true, message: t("form.class.nameRequired") },
              { min: 2, message: t("form.class.nameMinLength") },
            ]}>
            <Input placeholder={t("form.class.namePlaceholder")} />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="teacher"
            label={t("form.class.teacherLabel")}
            rules={[
              { required: true, message: t("form.class.teacherRequired") },
              { min: 2, message: t("form.class.teacherMinLength") },
            ]}>
            <Input placeholder={t("form.class.teacherPlaceholder")} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="description"
        label={t("form.class.descriptionLabel")}
        rules={[
          {
            validator: (_, value) => {
              if (!value || value.length === 0) {
                return Promise.resolve(); // Allow empty description
              }
              if (value.length < 5) {
                return Promise.reject(
                  new Error(t("form.class.descriptionMinLength"))
                );
              }
              return Promise.resolve();
            },
          },
        ]}>
        <TextArea
          rows={3}
          placeholder={t("form.class.descriptionPlaceholder")}
        />
      </Form.Item>

      <Form.Item
        name="room"
        label={t("form.class.roomLabel")}
        rules={[{ min: 1, message: t("form.class.roomRequired") }]}>
        <Input placeholder={t("form.class.roomPlaceholder")} />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="grades"
            label={t("form.class.gradesLabel")}
            rules={[
              { required: true, message: t("form.class.gradesRequired") },
            ]}>
            <Select
              mode="multiple"
              placeholder={t("form.class.gradesPlaceholder")}
              allowClear>
              {GRADES.map(grade => (
                <Option key={grade} value={grade}>
                  {GetGradeName(grade)}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col span={8}>
          <Form.Item
            name="isMandatory"
            label={t("form.class.typeLabel")}
            valuePropName="checked">
            <Switch
              checkedChildren={t("form.class.mandatoryOption")}
              unCheckedChildren={t("form.class.electiveOption")}
            />
          </Form.Item>
        </Col>

        <Col span={4}>
          <Form.Item
            name="scope"
            label={t("form.class.environmentLabel")}
            rules={[
              { required: true, message: t("form.class.environmentRequired") },
            ]}>
            <Select placeholder={t("form.class.environmentPlaceholder")}>
              <Option value="test">{t("form.class.testEnvironment")}</Option>
              <Option value="prod">
                {t("form.class.productionEnvironment")}
              </Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="isDouble"
            label={t("form.class.doubleLessonLabel")}
            valuePropName="checked">
            <Switch
              checkedChildren={t("form.class.doubleLessonChecked")}
              unCheckedChildren={t("form.class.doubleLessonUnchecked")}
              style={{ width: 120 }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="dayOfWeek"
            label={t("form.class.dayLabel")}
            rules={[{ required: true, message: t("form.class.dayRequired") }]}>
            <Select placeholder={t("form.class.dayPlaceholder")}>
              {DAYS_OF_WEEK.map((day: any) => (
                <Option key={day.key} value={day.key}>
                  {day.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="timeSlotId"
            label={t("form.class.timeLabel")}
            rules={[{ required: true, message: t("form.class.timeRequired") }]}>
            <Select
              placeholder={
                selectedDay !== undefined
                  ? t("form.class.timePlaceholder")
                  : t("form.class.selectDayFirst")
              }
              disabled={selectedDay === undefined}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)
                  ?.toLowerCase()
                  .includes(input.toLowerCase())
              }>
              {availableTimeSlots
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(slot => (
                  <Option key={slot.id} value={slot.id}>
                    {slot.name} -{" "}
                    {ScheduleService.formatTimeRange(
                      slot.startTime,
                      slot.endTime
                    )}
                  </Option>
                ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isNewLesson
              ? t("form.class.createButton")
              : t("form.class.updateButton")}
          </Button>
          <Button onClick={onCancel}>{t("common.buttons.cancel")}</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ClassForm;
