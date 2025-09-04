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
  Tag,
  message,
  Popconfirm,
  Badge
} from 'antd'
import { 
  CheckOutlined, 
  CloseOutlined, 
  ReloadOutlined, 
  ArrowLeftOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAuth } from '../contexts/AuthContext'
import { usersApi } from '../services/api'
import type { PendingApproval, UserRole } from '../types'
import './PendingApprovalsPage.css'

const { Content } = Layout
const { Title, Text } = Typography

interface PendingApprovalsPageProps {
  onNavigate?: (page: 'schedule' | 'class-management' | 'pending-approvals') => void
}

const PendingApprovalsPage: React.FC<PendingApprovalsPageProps> = ({ onNavigate }) => {
  const { isAdmin, signOut } = useAuth()
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await usersApi.getPendingApprovalsWithUsers()
      setPendingApprovals(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approvalId: string, userEmail: string, role: UserRole) => {
    setActionLoading(approvalId)
    try {
      await usersApi.approveRole(approvalId)
      message.success(`המשתמש ${userEmail} אושר בהצלחה לתפקיד ${getRoleDisplayName(role)}`)
      await loadData()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'שגיאה באישור המשתמש')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (approvalId: string, userEmail: string, role: UserRole) => {
    setActionLoading(approvalId)
    try {
      await usersApi.rejectRole(approvalId)
      message.success(`בקשת ${getRoleDisplayName(role)} של ${userEmail} נדחתה`)
      await loadData()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'שגיאה בדחיית הבקשה')
    } finally {
      setActionLoading(null)
    }
  }

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames = {
      admin: 'מנהל',
      staff: 'צוות',
      parent: 'הורה',
      child: 'תלמיד'
    }
    return roleNames[role] || role
  }

  const getRoleColor = (role: UserRole): string => {
    const roleColors = {
      admin: 'red',
      staff: 'orange',
      parent: 'blue',
      child: 'green'
    }
    return roleColors[role] || 'default'
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const columns: ColumnsType<PendingApproval> = [
    {
      title: 'כתובת אימייל',
      dataIndex: ['user', 'email'],
      key: 'email',
      width: 250,
      render: (email: string) => (
        <Space>
          <UserOutlined />
          <Text strong>{email}</Text>
        </Space>
      ),
    },
    {
      title: 'תפקיד מבוקש',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: UserRole) => (
        <Tag color={getRoleColor(role)}>
          {getRoleDisplayName(role)}
        </Tag>
      ),
    },
    {
      title: 'תאריך בקשה',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{formatDate(date)}</Text>
        </Space>
      ),
    },
    {
      title: 'פעולות',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Popconfirm
            title={`אישור תפקיד ${getRoleDisplayName(record.role)}`}
            description={`האם אתה בטוח שברצונך לאשר את ${record.user.email} לתפקיד ${getRoleDisplayName(record.role)}?`}
            onConfirm={() => handleApprove(record.id, record.user.email, record.role)}
            okText="אשר"
            cancelText="ביטול"
            placement="topRight"
          >
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={actionLoading === record.id}
              size="small"
            >
              אשר
            </Button>
          </Popconfirm>
          <Popconfirm
            title="דחיית בקשה"
            description={`האם אתה בטוח שברצונך לדחות את בקשת ${record.user.email} לתפקיד ${getRoleDisplayName(record.role)}?`}
            onConfirm={() => handleReject(record.id, record.user.email, record.role)}
            okText="דחה"
            cancelText="ביטול"
            placement="topRight"
          >
            <Button
              danger
              icon={<CloseOutlined />}
              loading={actionLoading === record.id}
              size="small"
            >
              דחה
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (!isAdmin()) {
    return (
      <Layout className="pending-approvals-page">
        <Content className="pending-approvals-content">
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
          טוען בקשות ממתינות...
        </Title>
      </div>
    )
  }

  return (
    <Layout className="pending-approvals-page">
      <Content className="pending-approvals-content">
        <div className="pending-approvals-header">
          <div className="header-main">
            <Title level={2}>
              <Space>
                בקשות ממתינות לאישור
                {pendingApprovals.length > 0 && (
                  <Badge count={pendingApprovals.length} color="#ff4d4f" />
                )}
              </Space>
            </Title>
            <Space>
              <Button 
                icon={<ArrowLeftOutlined />}
                onClick={() => onNavigate?.('schedule')}
              >
                חזרה למערכת השעות
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
            message="ניהול בקשות אישור"
            description={
              <div>
                כאן תוכל לאשר או לדחות בקשות של משתמשים חדשים להצטרף למערכת. לאחר אישור, המשתמש יוכל להיכנס למערכת ולהשתמש בתפקיד המבוקש.
                {lastRefresh && (
                  <div style={{ marginTop: 8, fontSize: '12px', opacity: 0.8 }}>
                    <ClockCircleOutlined /> עדכון אחרון: {lastRefresh.toLocaleTimeString('he-IL')}
                  </div>
                )}
              </div>
            }
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

        <Card className="pending-approvals-table-card">
          {pendingApprovals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <UserOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
              <Title level={4} style={{ color: '#999' }}>
                אין בקשות ממתינות לאישור
              </Title>
              <Text type="secondary">
                כל הבקשות אושרו או שלא הוגשו בקשות חדשות
              </Text>
            </div>
          ) : (
            <Table<PendingApproval>
              columns={columns}
              dataSource={pendingApprovals}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} מתוך ${total} בקשות`
              }}
              scroll={{ x: 800 }}
              size="small"
            />
          )}
        </Card>
      </Content>
    </Layout>
  )
}

export default PendingApprovalsPage