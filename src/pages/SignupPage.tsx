import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Checkbox } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useAuth } from "../hooks/useAuth";
import "./AuthPages.css";

const { Title, Text, Link } = Typography;

interface SignupFormValues {
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

interface SignupPageProps {
  onSwitchToLogin: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onSwitchToLogin }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();

  const onFinish = async (values: SignupFormValues) => {
    setLoading(true);
    setError(null);

    try {
      await signUp(values.email, values.password);
      setSuccess(true);
      form.resetFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהרשמה");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <Card className="auth-card">
            <div className="auth-header">
              <Title level={2}>הרשמה הושלמה בהצלחה!</Title>
            </div>

            <Alert
              message="בקשת הרשמה נשלחה"
              description={
                <div>
                  <p>תודה על הרשמתך למערכת השעות כהורה!</p>
                  <p>
                    בקשתך ממתינה לאישור מנהל המערכת. תקבל הודעה למייל כאשר
                    החשבון יאושר.
                  </p>
                  <p>בינתיים, תוכל לחזור לעמוד ההתחברות.</p>
                </div>
              }
              type="success"
              showIcon
              className="success-alert"
            />

            <div className="auth-footer">
              <Button
                type="primary"
                size="large"
                onClick={onSwitchToLogin}
                block>
                חזור לעמוד ההתחברות
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Title level={2}>הרשמה</Title>
            <Text type="secondary">צור חשבון הורה חדש במערכת השעות</Text>
          </div>

          {error && (
            <Alert
              message="שגיאה בהרשמה"
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
            name="signup"
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
            className="auth-form">
            <Form.Item
              name="email"
              label="כתובת דוא״ל"
              rules={[
                { required: true, message: "נא להזין כתובת דוא״ל" },
                { type: "email", message: "כתובת דוא״ל לא תקינה" },
              ]}>
              <Input
                prefix={<MailOutlined />}
                placeholder="your@email.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="סיסמה"
              rules={[
                { required: true, message: "נא להזין סיסמה" },
                { min: 6, message: "הסיסמה חייבת להכיל לפחות 6 תווים" },
              ]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="לפחות 6 תווים"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="אימות סיסמה"
              dependencies={["password"]}
              rules={[
                { required: true, message: "נא לאמת את הסיסמה" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("הסיסמאות אינן תואמות"));
                  },
                }),
              ]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="הזן שוב את הסיסמה"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="terms"
              valuePropName="checked"
              rules={[{ required: true, message: "נא לאשר את תנאי השימוש" }]}>
              <Checkbox>אני מסכים לתנאי השימוש ומדיניות הפרטיות</Checkbox>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                block
                className="auth-submit-btn">
                הירשם
              </Button>
            </Form.Item>
          </Form>

          <div className="auth-footer">
            <Text>
              כבר יש לך חשבון?{" "}
              <Link onClick={onSwitchToLogin}>התחבר עכשיו</Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
