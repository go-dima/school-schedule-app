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
  Tooltip,
} from "antd";
import { LockOutlined, MailOutlined, GoogleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROUTES } from "../routes/paths";
import { ToggleRadioGroup } from "../components/ToggleRadioGroup";
import { REQUESTABLE_ROLES, type RequestableRole } from "../constants/roles";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
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
  // Nothing is preselected: the user has to say what they are before either
  // signup path is enabled.
  const [requestedRole, setRequestedRole] = useState<RequestableRole>();
  const { signUp, signInWithGoogle, loading } = useAuth();

  // Explains why the signup buttons are disabled; no tooltip once a role is
  // chosen.
  const roleTooltip = requestedRole
    ? undefined
    : t("auth.signup.noRoleSelected");

  const roleOptions = REQUESTABLE_ROLES.map(role => ({
    value: role,
    label: t(`roles.${role}`),
    color: ROLE_TAG_COLORS[role],
  }));

  const onFinish = async (values: SignupFormValues) => {
    if (!requestedRole) return;
    setLocalError(null);

    try {
      await signUp(values.email, values.password, requestedRole);
      // This runs after signUp's shared `loading` flag has already unmounted and
      // remounted this component (see docs/superpowers/plans/2026-09-11-url-based-routing.md).
      // navigate() still works post-unmount because react-router v6's internal
      // navigate-stability guard isn't reset on unmount — an implementation detail,
      // not a documented contract. If a future react-router upgrade changes this,
      // this call would silently become a no-op.
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
      await signInWithGoogle(requestedRole);
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

          <div className="auth-role-picker">
            <Text strong id="signup-role-label">
              {t("auth.signup.roleLabel")}
            </Text>
            <ToggleRadioGroup<RequestableRole>
              options={roleOptions}
              value={requestedRole}
              onChange={setRequestedRole}
              disabled={loading}
              aria-labelledby="signup-role-label"
            />
            {!requestedRole && (
              <Text type="secondary" className="auth-role-picker__hint">
                {t("auth.signup.roleRequired")}
              </Text>
            )}
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
                { required: true, message: t("auth.login.emailRequired") },
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
              <Tooltip title={roleTooltip}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  disabled={loading || !requestedRole}
                  block
                  className="auth-submit-btn">
                  {t("auth.signup.signupButton")}
                </Button>
              </Tooltip>
            </Form.Item>
          </Form>

          <Divider plain>{t("auth.signup.or")}</Divider>

          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Tooltip title={roleTooltip}>
              <Button
                icon={<GoogleOutlined />}
                size="large"
                block
                loading={loading}
                disabled={loading || !requestedRole}
                onClick={handleGoogleSignIn}
                className="oauth-btn google-btn">
                {t("auth.signup.googleButton")}
              </Button>
            </Tooltip>
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
