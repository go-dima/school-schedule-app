import React, { useState } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Checkbox,
  Divider,
  Space,
} from "antd";
import { LockOutlined, MailOutlined, GoogleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();

  const onFinish = async (values: SignupFormValues) => {
    setLoading(true);
    setError(null);

    try {
      await signUp(values.email, values.password);
      setSuccess(true);
      form.resetFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.signup.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setOAuthLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.signup.googleError")
      );
    } finally {
      setOAuthLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <Card className="auth-card">
            <div className="auth-header">
              <Title level={2}>{t("auth.signup.successTitle")}</Title>
            </div>

            <Alert
              message={t("auth.signup.successAlertTitle")}
              description={
                <div>
                  <p>{t("auth.signup.successMessage1")}</p>
                  <p>{t("auth.signup.successMessage2")}</p>
                  <p>{t("auth.signup.successMessage3")}</p>
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
                {t("auth.signup.returnToLogin")}
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
            <Title level={2}>{t("auth.signup.title")}</Title>
            <Text type="secondary">{t("auth.signup.subtitle")}</Text>
          </div>

          {error && (
            <Alert
              message={t("auth.signup.error")}
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
              label={t("auth.signup.emailLabel")}
              rules={[
                { required: true, message: t("auth.signup.emailRequired") },
                { type: "email", message: t("auth.login.emailInvalid") },
              ]}>
              <Input
                prefix={<MailOutlined />}
                placeholder="your@email.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={t("auth.signup.passwordLabel")}
              rules={[
                { required: true, message: t("auth.login.passwordRequired") },
                { min: 6, message: t("auth.signup.passwordMinLength") },
              ]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t("auth.signup.passwordPlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label={t("auth.signup.confirmPasswordLabel")}
              dependencies={["password"]}
              rules={[
                {
                  required: true,
                  message: t("auth.signup.confirmPasswordRequired"),
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error(t("auth.signup.passwordMismatch"))
                    );
                  },
                }),
              ]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t("auth.signup.confirmPasswordPlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="terms"
              valuePropName="checked"
              rules={[
                { required: true, message: t("auth.signup.termsRequired") },
              ]}>
              <Checkbox>{t("auth.signup.termsCheckbox")}</Checkbox>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                disabled={oauthLoading}
                block
                className="auth-submit-btn">
                {t("auth.signup.signupButton")}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>{t("auth.signup.or")}</Divider>

          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Button
              icon={<GoogleOutlined />}
              size="large"
              block
              loading={oauthLoading}
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="oauth-btn google-btn">
              {t("auth.signup.googleButton")}
            </Button>
          </Space>

          <div className="auth-footer">
            <Text>
              {t("auth.signup.loginPrompt")}{" "}
              <Link onClick={onSwitchToLogin}>
                {t("auth.signup.loginLink")}
              </Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
