import React, { useEffect, useRef } from "react";
import { Form, Input, Select, Button, Space, Switch, Row, Col } from "antd";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { ScheduleService } from "../services/scheduleService";
import { getLessonTimeSlots } from "../utils/timeSlots";
import type { Class, ClassSlot, ClassWithTimeSlot, TimeSlot } from "../types";
import { GRADES, DAYS_OF_WEEK } from "../types";
import { GetGradeName } from "@/utils/grades";
import { ScopeSelector } from "./ScopeSelector";

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

  // Time slots are day-independent, so the same lesson-slot list applies to
  // every day and every row in the slot picker.
  const availableTimeSlots = getLessonTimeSlots(timeSlots);

  const isDoubleValue = Form.useWatch("isDouble", form);
  const slotsValue = Form.useWatch("slots", form) as
    | Partial<ClassSlot>[]
    | undefined;
  const anchorDayOfWeek = slotsValue?.[0]?.dayOfWeek;
  const anchorTimeSlotId = slotsValue?.[0]?.timeSlotId;

  // Tracks the (dayOfWeek, timeSlotId) pair the Double Lesson toggle last
  // auto-filled, so toggling it off, or moving the anchor slot, removes
  // exactly that entry and never a hand-edited row.
  const autoSlotRef = useRef<ClassSlot | null>(null);

  useEffect(() => {
    const currentSlots: Partial<ClassSlot>[] =
      form.getFieldValue("slots") || [];
    const previousAuto = autoSlotRef.current;

    let nextSlots = previousAuto
      ? currentSlots.filter(
          s =>
            !(
              s?.dayOfWeek === previousAuto.dayOfWeek &&
              s?.timeSlotId === previousAuto.timeSlotId
            )
        )
      : currentSlots;

    autoSlotRef.current = null;

    if (isDoubleValue && anchorTimeSlotId && anchorDayOfWeek !== undefined) {
      const anchorSlot = timeSlots.find(s => s.id === anchorTimeSlotId);
      const nextTimeSlot = anchorSlot
        ? ScheduleService.getNextConsecutiveTimeSlot(anchorSlot, timeSlots)
        : null;

      if (nextTimeSlot) {
        const expected: ClassSlot = {
          dayOfWeek: anchorDayOfWeek,
          timeSlotId: nextTimeSlot.id,
        };
        const alreadyPresent = nextSlots.some(
          s =>
            s?.dayOfWeek === expected.dayOfWeek &&
            s?.timeSlotId === expected.timeSlotId
        );
        if (!alreadyPresent) {
          nextSlots = [...nextSlots, expected];
        }
        autoSlotRef.current = expected;
      }
    }

    if (nextSlots !== currentSlots) {
      form.setFieldValue("slots", nextSlots);
    }
  }, [isDoubleValue, anchorDayOfWeek, anchorTimeSlotId, timeSlots]);

  const handleSubmit = async (values: any) => {
    try {
      const classData: Omit<Class, "id" | "createdAt" | "updatedAt"> = {
        title: values.title,
        description: values.description || "",
        teacher: values.teacher,
        slots: values.slots,
        grades: values.grades || [],
        isMandatory: values.isMandatory || false,
        isDouble: values.isDouble || false,
        groupNumber: values.groupNumber ?? null,
        trackNumber: values.trackNumber ?? null,
        room: values.room || "",
        scope: values.scope || "prod",
      };

      await onSubmit(classData);
    } catch (error) {
      console.error("ClassForm submission error:", error);
      throw error; // Re-throw to let parent handle
    }
  };

  // The Double Lesson toggle always anchors on slots[0]. On edit, put the
  // actual double-lesson pair first — found by adjacency, not by whatever
  // order the slots happen to load in — so an unrelated extra slot (sorted
  // earlier by day/time) can't get mistaken for the anchor.
  const initialSlots = (() => {
    if (!initialValues) return [{}];

    const doublePair = ScheduleService.getDoubleLessonPair(
      initialValues,
      timeSlots
    );
    const ordered = doublePair
      ? [
          doublePair[0],
          doublePair[1],
          ...initialValues.slots.filter(
            s => s !== doublePair[0] && s !== doublePair[1]
          ),
        ]
      : initialValues.slots;

    return ScheduleService.toRawSlots(ordered);
  })();

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
              slots: initialSlots,
              grades: initialValues.grades || [],
              isMandatory: initialValues.isMandatory,
              isDouble: initialValues.isDouble,
              groupNumber: initialValues.groupNumber,
              trackNumber: initialValues.trackNumber,
              room: initialValues.room,
              scope: initialValues.scope,
            }
          : {
              description: "",
              slots: [{}],
              isMandatory: false,
              isDouble: false,
              groupNumber: null,
              trackNumber: null,
              room: "",
              scope: "prod",
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

        <Col span={6}>
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

        <Col span={6}>
          <ScopeSelector
            value={form.getFieldValue("scope")}
            onChange={value => form.setFieldValue("scope", value)}
          />
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
          <Form.Item name="groupNumber" label={t("form.class.groupLabel")}>
            <Select placeholder={t("form.class.groupPlaceholder")} allowClear>
              <Option value={1}>{t("form.class.group1")}</Option>
              <Option value={2}>{t("form.class.group2")}</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="trackNumber" label={t("form.class.trackLabel")}>
            <Select placeholder={t("form.class.trackPlaceholder")} allowClear>
              <Option value={1}>{t("form.class.track1")}</Option>
              <Option value={2}>{t("form.class.track2")}</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label={t("form.class.slotsLabel")}>
        <Form.List
          name="slots"
          rules={[
            {
              validator: async (_, slots: Partial<ClassSlot>[]) => {
                if (!slots || slots.length < 1) {
                  return Promise.reject(
                    new Error(t("form.class.slotsRequired"))
                  );
                }
                const seen = new Set<string>();
                for (const slot of slots) {
                  if (slot?.dayOfWeek === undefined || !slot?.timeSlotId) {
                    continue;
                  }
                  const key = ScheduleService.slotKey(slot as ClassSlot);
                  if (seen.has(key)) {
                    return Promise.reject(
                      new Error(t("form.class.slotsDuplicate"))
                    );
                  }
                  seen.add(key);
                }
              },
            },
          ]}>
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map(field => (
                <Row gutter={8} key={field.key} align="middle">
                  <Col span={10}>
                    <Form.Item
                      name={[field.name, "dayOfWeek"]}
                      rules={[
                        {
                          required: true,
                          message: t("form.class.dayRequired"),
                        },
                      ]}>
                      <Select placeholder={t("form.class.dayPlaceholder")}>
                        {DAYS_OF_WEEK.map(day => (
                          <Option key={day.key} value={day.key}>
                            {day.name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>

                  <Col span={10}>
                    <Form.Item
                      name={[field.name, "timeSlotId"]}
                      rules={[
                        {
                          required: true,
                          message: t("form.class.timeRequired"),
                        },
                      ]}>
                      <Select
                        placeholder={t("form.class.timePlaceholder")}
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          (option?.children as unknown as string)
                            ?.toLowerCase()
                            .includes(input.toLowerCase())
                        }>
                        {availableTimeSlots
                          .sort((a, b) =>
                            a.startTime.localeCompare(b.startTime)
                          )
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

                  <Col span={4}>
                    {fields.length > 1 && (
                      <MinusCircleOutlined onClick={() => remove(field.name)} />
                    )}
                  </Col>
                </Row>
              ))}
              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}>
                  {t("form.class.addSlotButton")}
                </Button>
                <Form.ErrorList errors={errors} />
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form.Item>

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
