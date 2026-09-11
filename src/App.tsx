import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ChildProvider } from "./contexts/ChildContext";
import { ContextErrorBoundary } from "./components/ErrorBoundary";
import { router } from "./routes/router";
import { Spin, Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import "./App.css";

function AppContent() {
  const { loading, error, clearApplicationState } = useAuth();
  const { t } = useTranslation();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Timeout protection for loading state
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (loading) {
      timeoutId = setTimeout(() => {
        setLoadingTimeout(true);
      }, 5000); // 5 second timeout
    } else {
      setLoadingTimeout(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loading]);

  // Emergency state clearing keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+Delete or Cmd+Shift+Delete to clear application state
      if (event.ctrlKey && event.shiftKey && event.key === "Delete") {
        event.preventDefault();
        console.log("🚨 Emergency state clear triggered by keyboard shortcut");
        clearApplicationState();
        window.location.reload();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearApplicationState]);

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
          title={t("errors.auth.title", "Authentication Error")}
          subTitle={error}
          extra={[
            <Button
              type="primary"
              key="retry"
              onClick={() => window.location.reload()}>
              {t("errors.auth.retry", "Try Again")}
            </Button>,
          ]}
        />
      </div>
    );
  }

  // Show timeout warning with recovery options
  if (loadingTimeout) {
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
          status="warning"
          title={t(
            "errors.timeout.title",
            "Loading is taking longer than expected"
          )}
          subTitle={t(
            "errors.timeout.subtitle",
            "The application may be experiencing connectivity issues."
          )}
          extra={[
            <Button
              type="primary"
              key="clear-state"
              onClick={() => {
                clearApplicationState();
                window.location.reload();
              }}>
              {t("errors.timeout.clearState", "Clear State & Refresh")}
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
      <AuthProvider>
        <ChildProvider>
          <AppContent />
        </ChildProvider>
      </AuthProvider>
    </ContextErrorBoundary>
  );
}

export default App;
