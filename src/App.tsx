import { RouterProvider } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ChildProvider } from "./contexts/ChildContext";
import { AllChildrenProvider } from "./contexts/AllChildrenContext";
import { ContextErrorBoundary } from "./components/ErrorBoundary";
import { UiModeProvider } from "./contexts/UiModeContext";
import { router } from "./routes/router";
import { Spin, Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import "./App.css";

function AppContent() {
  const { loading, error } = useAuth();
  const { t } = useTranslation();

  // Show error state with recovery options
  if (error && !loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          padding: "20px",
        }}>
        <Result
          status="error"
          title={t("errors.auth.title")}
          subTitle={error}
          extra={[
            <Button
              type="primary"
              key="retry"
              onClick={() => window.location.reload()}>
              {t("errors.auth.retry")}
            </Button>,
          ]}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}>
        <Spin size="large" />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

function App() {
  return (
    <ContextErrorBoundary>
      <UiModeProvider>
        <AuthProvider>
          <ChildProvider>
            <AllChildrenProvider>
              <AppContent />
            </AllChildrenProvider>
          </ChildProvider>
        </AuthProvider>
      </UiModeProvider>
    </ContextErrorBoundary>
  );
}

export default App;
