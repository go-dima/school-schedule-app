import React, { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Space, Divider } from 'antd'
import { UserOutlined, LockOutlined, GoogleOutlined, GithubOutlined } from '@ant-design/icons'
import { useAuth } from '../hooks/useAuth'
import './AuthPages.css'

const { Title, Text, Link } = Typography

interface LoginFormValues {
  email: string
  password: string
}

interface LoginPageProps {
  onSwitchToSignup: () => void
}

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignup }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signIn } = useAuth()

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true)
    setError(null)

    try {
      await signIn(values.email, values.password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    console.log(`OAuth sign in with ${provider}`)
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Title level={2}>התחברות</Title>
            <Text type="secondary">
              היכנס למערכת השעות שלך
            </Text>
          </div>

          {error && (
            <Alert
              message="שגיאה בהתחברות"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              className="auth-alert"
            />
          )}

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
            className="auth-form"
          >
            <Form.Item
              name="email"
              label="כתובת דוא״ל"
              rules={[
                { required: true, message: 'נא להזין כתובת דוא״ל' },
                { type: 'email', message: 'כתובת דוא״ל לא תקינה' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="your@email.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="סיסמה"
              rules={[{ required: true, message: 'נא להזין סיסמה' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="הסיסמה שלך"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                block
                className="auth-submit-btn"
              >
                התחבר
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>או</Divider>

          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Button
              icon={<GoogleOutlined />}
              size="large"
              block
              onClick={() => handleOAuthSignIn('google')}
              className="oauth-btn google-btn"
            >
              התחבר עם Google
            </Button>
            
            <Button
              icon={<GithubOutlined />}
              size="large"
              block
              onClick={() => handleOAuthSignIn('github')}
              className="oauth-btn github-btn"
            >
              התחבר עם GitHub
            </Button>
          </Space>

          <div className="auth-footer">
            <Text>
              עדיין אין לך חשבון?{' '}
              <Link onClick={onSwitchToSignup}>
                הירשם עכשיו
              </Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default LoginPage