// src/pages/SignupPage.tsx
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
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROUTES } from "../routes/paths";
import "./AuthPages.css";

const { Title, Text, Link } = Typography;

interface SignupFormValues {
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

const SignupPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [localError, setLocalError] = useState<string | null>(null);
  const { signUp, signInWithGoogle, loading } = useAuth();

  const onFinish = async (values: SignupFormValues) => {
    setLocalError(null);

    try {
      await signUp(values.email, values.password);
      navigate(ROUTES.SIGNUP_VERIFY_EMAIL, {
        state: { fromSignup: true },
        replace: true,
      });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("auth.signup.error")
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);

    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("auth.signup.googleError")
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Title level={2}>{t("auth.signup.title")}</Title>
            <Text type="secondary">{t("auth.signup.subtitle")}</Text>
          </div>

          {localError && (
            <Alert
              message={t("auth.signup.error")}
              description={localError}
              type="error"
              showIcon
              closable
              onClose={() => setLocalError(null)}
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
                disabled={loading}
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
              loading={loading}
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="oauth-btn google-btn">
              {t("auth.signup.googleButton")}
            </Button>
          </Space>

          <div className="auth-footer">
            <Text>
              {t("auth.signup.loginPrompt")}{" "}
              <Link onClick={() => navigate(ROUTES.LOGIN)}>
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
