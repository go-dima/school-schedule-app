import React, { useState, useEffect } from 'react'
import { 
  Layout, 
  Card, 
  Typography, 
  Table, 
  Button, 
  Space, 
  Alert, 
  Spin, 
  Modal, 
  message,
  Popconfirm,
  Tag
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAuth } from '../contexts/AuthContext'
import { classesApi, timeSlotsApi } from '../services/api'
import { ScheduleService } from '../services/scheduleService'
import type { ClassWithTimeSlot, TimeSlot, Class } from '../types'
import ClassForm from '../components/ClassForm'
import './ClassManagementPage.css'

const { Content } = Layout
const { Title } = Typography

interface ClassManagementPageProps {
  onNavigate?: (page: 'schedule' | 'class-management') => void
}

const ClassManagementPage: React.FC<ClassManagementPageProps> = ({ onNavigate }) => {
  const { isAdmin, signOut } = useAuth()
  const [classes, setClasses] = useState<ClassWithTimeSlot[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassWithTimeSlot | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [classesData, timeSlotsData] = await Promise.all([
        classesApi.getClasses(),
        timeSlotsApi.getTimeSlots()
      ])

      setClasses(classesData)
      setTimeSlots(timeSlotsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddClass = () => {
    setEditingClass(null)
    setModalVisible(true)
  }

  const handleEditClass = (cls: ClassWithTimeSlot) => {
    setEditingClass(cls)
    setModalVisible(true)
  }

  const handleDeleteClass = async (classId: string) => {
    try {
      await classesApi.deleteClass(classId)
      message.success('השיעור נמחק בהצלחה')
      await loadData()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'שגיאה במחיקת השיעור')
    }
  }

  const handleFormSubmit = async (classData: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingClass) {
        await classesApi.updateClass(editingClass.id, classData)
        message.success('השיעור עודכן בהצלחה')
      } else {
        await classesApi.createClass(classData)
        message.success('השיעור נוצר בהצלחה')
      }
      
      setModalVisible(false)
      await loadData()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'שגיאה בשמירת השיעור')
    }
  }

  const handleModalCancel = () => {
    setModalVisible(false)
    setEditingClass(null)
  }

  const getTimeSlotDisplay = (timeSlot: TimeSlot) => {
    const timeRange = ScheduleService.formatTimeRange(timeSlot.startTime, timeSlot.endTime)
    const dayName = ScheduleService.getDayName(timeSlot.dayOfWeek)
    return `${dayName} - ${timeSlot.name} ${timeRange ? `(${timeRange})` : ''}`
  }

  const columns: ColumnsType<ClassWithTimeSlot> = [
    {
      title: 'שם השיעור',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: 'תיאור',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
    },
    {
      title: 'מורה',
      dataIndex: 'teacher',
      key: 'teacher',
      width: 150,
    },
    {
      title: 'כיתה',
      dataIndex: 'grade',
      key: 'grade',
      width: 100,
      render: (grade: number) => ScheduleService.getGradeName(grade),
    },
    {
      title: 'זמן השיעור',
      dataIndex: 'timeSlot',
      key: 'timeSlot',
      width: 200,
      render: (timeSlot: TimeSlot) => getTimeSlotDisplay(timeSlot),
    },
    {
      title: 'סוג',
      dataIndex: 'isMandatory',
      key: 'isMandatory',
      width: 80,
      render: (isMandatory: boolean) => (
        <Tag color={isMandatory ? 'red' : 'blue'}>
          {isMandatory ? 'חובה' : 'בחירה'}
        </Tag>
      ),
    },
    {
      title: 'פעולות',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditClass(record)}
            size="small"
          >
            ערוך
          </Button>
          <Popconfirm
            title="האם אתה בטוח שברצונך למחוק את השיעור?"
            description="פעולה זו תמחק את השיעור ואת כל הבחירות הקשורות אליו"
            onConfirm={() => handleDeleteClass(record.id)}
            okText="כן"
            cancelText="לא"
          >
            <Button
              type="link"
              icon={<DeleteOutlined />}
              danger
              size="small"
            >
              מחק
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (!isAdmin()) {
    return (
      <Layout className="class-management-page">
        <Content className="class-management-content">
          <Alert
            message="אין הרשאה"
            description="רק מנהלים יכולים לגשת לדף זה"
            type="error"
            showIcon
          />
        </Content>
      </Layout>
    )
  }

  if (loading) {
    return (
      <div className="page-loading">
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 16, color: '#1890ff' }}>
          טוען נתוני שיעורים...
        </Title>
      </div>
    )
  }

  return (
    <Layout className="class-management-page">
      <Content className="class-management-content">
        <div className="class-management-header">
          <div className="header-main">
            <Title level={2}>ניהול שיעורים</Title>
            <Space>
              <Button 
                icon={<ArrowLeftOutlined />}
                onClick={() => onNavigate?.('schedule')}
              >
                חזרה למערכת השעות
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={handleAddClass}
              >
                הוסף שיעור חדש
              </Button>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadData}
                disabled={loading}
              >
                רענן
              </Button>
              <Button 
                type="primary" 
                danger 
                onClick={signOut}
              >
                התנתק
              </Button>
            </Space>
          </div>

          <Alert
            message="ניהול שיעורים"
            description="כאן תוכל להוסיף, לערוך ולמחוק שיעורים. שים לב שמחיקת שיעור תמחק גם את כל הבחירות הקשורות אליו."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        </div>

        {error && (
          <Alert
            message="שגיאה בטעינת הנתונים"
            description={error}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 24 }}
          />
        )}

        <Card className="classes-table-card">
          <Table<ClassWithTimeSlot>
            columns={columns}
            dataSource={classes}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} מתוך ${total} שיעורים`
            }}
            scroll={{ x: 1000 }}
            size="small"
          />
        </Card>

        <Modal
          title={editingClass ? 'ערוך שיעור' : 'הוסף שיעור חדש'}
          open={modalVisible}
          onCancel={handleModalCancel}
          footer={null}
          width={600}
          destroyOnClose
        >
          <ClassForm
            initialValues={editingClass}
            timeSlots={timeSlots}
            onSubmit={handleFormSubmit}
            onCancel={handleModalCancel}
            loading={loading}
          />
        </Modal>
      </Content>
    </Layout>
  )
}

export default ClassManagementPage