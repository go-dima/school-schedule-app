import React, { useState, useEffect } from "react";
import { Form, Input, Select, Button, Space, Switch, Row, Col } from "antd";
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
            label="שם השיעור"
            rules={[
              { required: true, message: "נא להזין שם לשיעור" },
              { min: 2, message: "שם השיעור חייב להכיל לפחות 2 תווים" },
            ]}>
            <Input placeholder="למשל: מתמטיקה" />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="teacher"
            label="שם המורה"
            rules={[
              { required: true, message: "נא להזין שם המורה" },
              { min: 2, message: "שם המורה חייב להכיל לפחות 2 תווים" },
            ]}>
            <Input placeholder="למשל: יעל כהן" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="description"
        label="תיאור השיעור (אופציונלי)"
        rules={[
          {
            validator: (_, value) => {
              if (!value || value.length === 0) {
                return Promise.resolve(); // Allow empty description
              }
              if (value.length < 5) {
                return Promise.reject(
                  new Error("התיאור חייב להכיל לפחות 5 תווים")
                );
              }
              return Promise.resolve();
            },
          },
        ]}>
        <TextArea
          rows={3}
          placeholder="תיאור קצר על השיעור, הנושאים שנלמדים וכו'"
        />
      </Form.Item>

      <Form.Item
        name="room"
        label="כיתה/חדר"
        rules={[{ min: 1, message: "נא להזין מיקום הכיתה" }]}>
        <Input placeholder="למשל: כיתה 101, מעבדה מדעים" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="grades"
            label="כיתות"
            rules={[{ required: true, message: "נא לבחור לפחות כיתה אחת" }]}>
            <Select mode="multiple" placeholder="בחר כיתות" allowClear>
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
            label="סוג השיעור"
            valuePropName="checked">
            <Switch checkedChildren="ליבה" unCheckedChildren="בחירה" />
          </Form.Item>
        </Col>

        <Col span={4}>
          <Form.Item
            name="scope"
            label="סביבה"
            rules={[{ required: true, message: "נא לבחור סביבה" }]}>
            <Select placeholder="בחר סביבה">
              <Option value="test">בדיקות</Option>
              <Option value="prod">מערכת</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="isDouble" label="שיעור כפול" valuePropName="checked">
            <Switch
              checkedChildren="שיעור כפול"
              unCheckedChildren="שיעור רגיל"
              style={{ width: 120 }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="dayOfWeek"
            label="יום"
            rules={[{ required: true, message: "נא לבחור יום לשיעור" }]}>
            <Select placeholder="בחר יום">
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
            label="שעה"
            rules={[{ required: true, message: "נא לבחור שעת השיעור" }]}>
            <Select
              placeholder={
                selectedDay !== undefined ? "בחר שעה" : "בחר יום תחילה"
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
            {isNewLesson ? "צור שיעור" : "עדכן שיעור"}
          </Button>
          <Button onClick={onCancel}>ביטול</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ClassForm;
