// src/pages/SignupVerifyEmailPage.tsx
import React from "react";
import { Card, Typography, Alert, Button } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes/paths";
import "./AuthPages.css";

const { Title } = Typography;

const SignupVerifyEmailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Title level={2}>{t("auth.signup.verifyEmail.title")}</Title>
          </div>

          <Alert
            message={t("auth.signup.verifyEmail.alertTitle")}
            description={
              <div>
                <p>{t("auth.signup.verifyEmail.message1")}</p>
                <p>{t("auth.signup.verifyEmail.message2")}</p>
                <p>{t("auth.signup.verifyEmail.message3")}</p>
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
              onClick={() => navigate(ROUTES.LOGIN)}
              block>
              {t("auth.signup.verifyEmail.returnToLogin")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignupVerifyEmailPage;
