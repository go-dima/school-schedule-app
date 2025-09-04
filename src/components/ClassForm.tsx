import React, { useState, useEffect } from "react";
import { Form, Input, Select, Button, Space, Switch, Row, Col } from "antd";
import { ScheduleService } from "../services/scheduleService";
import { getLessonTimeSlots } from "../utils/timeSlots";
import type { ClassWithTimeSlot, TimeSlot, Class } from "../types";
import { GRADES } from "../types";

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

  // Group time slots by day for better organization
  const timeSlotsByDay = lessonTimeSlots.reduce((acc, slot) => {
    const day = slot.dayOfWeek;
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(slot);
    return acc;
  }, {} as Record<number, TimeSlot[]>);

  // Get available days
  const availableDays = Object.keys(timeSlotsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  // Get time slots for selected day
  const availableTimeSlots =
    selectedDay !== undefined ? timeSlotsByDay[selectedDay] || [] : [];

  // Initialize form values and set initial day
  useEffect(() => {
    if (initialValues?.timeSlot) {
      // Use timeSlot from initialValues if available (preferred for pre-filled forms)
      const dayOfWeek = initialValues.timeSlot.dayOfWeek;
      setSelectedDay(dayOfWeek);
    } else if (initialValues?.timeSlotId) {
      // Find timeSlot from timeSlotId
      const initialTimeSlot = lessonTimeSlots.find(
        (slot) => slot.id === initialValues.timeSlotId
      );
      if (initialTimeSlot) {
        const dayOfWeek = initialTimeSlot.dayOfWeek;
        setSelectedDay(dayOfWeek);
      }
    }
  }, [initialValues, lessonTimeSlots]);

  // Watch for dayOfWeek field changes from form and update selectedDay
  const dayOfWeekValue = Form.useWatch('dayOfWeek', form);
  
  useEffect(() => {
    if (dayOfWeekValue !== undefined) {
      // Clear time slot if day actually changed to a different day
      if (selectedDay !== undefined && selectedDay !== dayOfWeekValue) {
        form.setFieldsValue({ timeSlotId: undefined });
      }
      
      setSelectedDay(dayOfWeekValue);
    }
  }, [dayOfWeekValue, selectedDay, form]);

  const handleSubmit = async (values: any) => {
    try {
      const classData: Omit<Class, "id" | "createdAt" | "updatedAt"> = {
        title: values.title,
        description: values.description,
        teacher: values.teacher,
        timeSlotId: values.timeSlotId,
        grades: values.grades || [],
        isMandatory: values.isMandatory || false,
      };

      await onSubmit(classData);
    } catch (error) {
      console.error('ClassForm submission error:', error);
      throw error; // Re-throw to let parent handle
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onFinishFailed={(errorInfo) => {
        console.error('Form validation failed:', errorInfo);
      }}
      initialValues={
        initialValues
          ? {
              title: initialValues.title,
              description: initialValues.description,
              teacher: initialValues.teacher,
              dayOfWeek: initialValues.timeSlot?.dayOfWeek,
              timeSlotId: initialValues.timeSlotId,
              grades: initialValues.grades || [],
              isMandatory: initialValues.isMandatory,
            }
          : {
              isMandatory: false,
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
        rules={[{ min: 5, message: "התיאור חייב להכיל לפחות 5 תווים" }]}>
        <TextArea
          rows={3}
          placeholder="תיאור קצר על השיעור, הנושאים שנלמדים וכו'"
        />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="grades"
            label="כיתות"
            rules={[{ required: true, message: "נא לבחור לפחות כיתה אחת" }]}>
            <Select mode="multiple" placeholder="בחר כיתות" allowClear>
              {GRADES.map((grade) => (
                <Option key={grade} value={grade}>
                  {ScheduleService.getGradeName(grade)}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="isMandatory"
            label="סוג השיעור"
            valuePropName="checked">
            <Switch checkedChildren="חובה" unCheckedChildren="בחירה" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="dayOfWeek"
            label="יום"
            rules={[{ required: true, message: "נא לבחור יום לשיעור" }]}>
            <Select
              placeholder="בחר יום">
              {availableDays.map((day) => (
                <Option key={day} value={day}>
                  {ScheduleService.getDayName(day)}
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
                .map((slot) => (
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
