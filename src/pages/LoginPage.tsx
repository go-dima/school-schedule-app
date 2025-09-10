import React, { useState } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Divider,
  Space,
} from "antd";
import { UserOutlined, LockOutlined, GoogleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import "./AuthPages.css";

const { Title, Text, Link } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

interface LoginPageProps {
  onSwitchToSignup: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignup }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signInWithGoogle } = useAuth();

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    setError(null);

    try {
      await signIn(values.email, values.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.error"));
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
        err instanceof Error ? err.message : t("auth.login.googleError")
      );
    } finally {
      setOAuthLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Title level={2}>{t("auth.login.title")}</Title>
            <Text type="secondary">{t("auth.login.subtitle")}</Text>
          </div>

          {error && (
            <Alert
              message={t("auth.login.error")}
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
            className="auth-form">
            <Form.Item
              name="email"
              label={t("auth.login.emailLabel")}
              rules={[
                { required: true, message: t("auth.login.emailRequired") },
                { type: "email", message: t("auth.login.emailInvalid") },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder={t("auth.login.emailPlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={t("auth.login.passwordLabel")}
              rules={[
                { required: true, message: t("auth.login.passwordRequired") },
              ]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t("auth.login.passwordPlaceholder")}
                size="large"
              />
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
                {t("auth.login.loginButton")}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>{t("auth.login.or")}</Divider>

          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Button
              icon={<GoogleOutlined />}
              size="large"
              block
              loading={oauthLoading}
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="oauth-btn google-btn">
              {t("auth.login.googleButton")}
            </Button>
          </Space>

          <div className="auth-footer">
            <Text>
              {t("auth.login.signupPrompt")}{" "}
              <Link onClick={onSwitchToSignup}>
                {t("auth.login.signupLink")}
              </Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
