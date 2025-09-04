import React from 'react'
import { Form, Input, Select, Button, Space, Switch, Row, Col } from 'antd'
import { ScheduleService } from '../services/scheduleService'
import { getLessonTimeSlots } from '../utils/timeSlots'
import type { ClassWithTimeSlot, TimeSlot, Class } from '../types'
import { GRADES } from '../types'

const { TextArea } = Input
const { Option } = Select

interface ClassFormProps {
  initialValues?: ClassWithTimeSlot | null
  timeSlots: TimeSlot[]
  onSubmit: (values: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

const ClassForm: React.FC<ClassFormProps> = ({
  initialValues,
  timeSlots,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [form] = Form.useForm()

  // Filter to only show lesson time slots (not breaks or meetings)
  const lessonTimeSlots = getLessonTimeSlots(timeSlots)

  const handleSubmit = async (values: any) => {
    const classData: Omit<Class, 'id' | 'createdAt' | 'updatedAt'> = {
      title: values.title,
      description: values.description,
      teacher: values.teacher,
      timeSlotId: values.timeSlotId,
      grade: values.grade,
      isMandatory: values.isMandatory || false
    }

    await onSubmit(classData)
  }

  const getTimeSlotDisplay = (timeSlot: TimeSlot) => {
    const timeRange = ScheduleService.formatTimeRange(timeSlot.startTime, timeSlot.endTime)
    const dayName = ScheduleService.getDayName(timeSlot.dayOfWeek)
    return `${dayName} - ${timeSlot.name} ${timeRange ? `(${timeRange})` : ''}`
  }

  // Group time slots by day for better organization
  const timeSlotsByDay = lessonTimeSlots.reduce((acc, slot) => {
    const day = slot.dayOfWeek
    if (!acc[day]) {
      acc[day] = []
    }
    acc[day].push(slot)
    return acc
  }, {} as Record<number, TimeSlot[]>)

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={
        initialValues
          ? {
              title: initialValues.title,
              description: initialValues.description,
              teacher: initialValues.teacher,
              timeSlotId: initialValues.timeSlotId,
              grade: initialValues.grade,
              isMandatory: initialValues.isMandatory
            }
          : {
              isMandatory: false
            }
      }
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="title"
            label="שם השיעור"
            rules={[
              { required: true, message: 'נא להזין שם לשיעור' },
              { min: 2, message: 'שם השיעור חייב להכיל לפחות 2 תווים' }
            ]}
          >
            <Input placeholder="למשל: מתמטיקה" />
          </Form.Item>
        </Col>
        
        <Col span={12}>
          <Form.Item
            name="teacher"
            label="שם המורה"
            rules={[
              { required: true, message: 'נא להזין שם המורה' },
              { min: 2, message: 'שם המורה חייב להכיל לפחות 2 תווים' }
            ]}
          >
            <Input placeholder="למשל: יעל כהן" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="description"
        label="תיאור השיעור"
        rules={[
          { required: true, message: 'נא להזין תיאור לשיעור' },
          { min: 5, message: 'התיאור חייב להכיל לפחות 5 תווים' }
        ]}
      >
        <TextArea 
          rows={3} 
          placeholder="תיאור קצר על השיעור, הנושאים שנלמדים וכו'"
        />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="grade"
            label="כיתה"
            rules={[{ required: true, message: 'נא לבחור כיתה' }]}
          >
            <Select placeholder="בחר כיתה">
              {GRADES.map(grade => (
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
            valuePropName="checked"
          >
            <Switch 
              checkedChildren="חובה" 
              unCheckedChildren="בחירה"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="timeSlotId"
        label="זמן השיעור"
        rules={[{ required: true, message: 'נא לבחור זמן לשיעור' }]}
      >
        <Select 
          placeholder="בחר זמן לשיעור"
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) =>
            (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
          }
        >
          {Object.entries(timeSlotsByDay)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([dayOfWeek, slots]) => (
              <Select.OptGroup 
                key={dayOfWeek} 
                label={ScheduleService.getDayName(parseInt(dayOfWeek))}
              >
                {slots
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map(slot => (
                    <Option key={slot.id} value={slot.id}>
                      {slot.name} - {ScheduleService.formatTimeRange(slot.startTime, slot.endTime)}
                    </Option>
                  ))}
              </Select.OptGroup>
            ))}
        </Select>
      </Form.Item>

      <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
        <Space>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
          >
            {initialValues ? 'עדכן שיעור' : 'צור שיעור'}
          </Button>
          <Button onClick={onCancel}>
            ביטול
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default ClassForm