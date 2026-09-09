import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ChildProvider } from "./contexts/ChildContext";
import { ContextErrorBoundary } from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import SchedulePage from "./pages/SchedulePage";
import ClassManagementPage from "./pages/ClassManagementPage";
import PendingApprovalsPage from "./pages/PendingApprovalsPage";
import UserManagementPage from "./pages/UserManagementPage";
import UserListPage from "./pages/UserListPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import StudentsPage from "./pages/StudentsPage";
import AppLayout from "./layouts/AppLayout";
import { Spin, Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import "./App.css";

type Page =
  | "schedule"
  | "class-management"
  | "students"
  | "pending-approvals"
  | "user-management"
  | "user-list"
  | "profile-settings";

function AppContent() {
  const { user, userRoles, loading, error, clearApplicationState } = useAuth();
  const { t } = useTranslation();
  const [showSignup, setShowSignup] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>("schedule");
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

  if (!user) {
    if (showSignup) {
      return <SignupPage onSwitchToLogin={() => setShowSignup(false)} />;
    }
    return <LoginPage onSwitchToSignup={() => setShowSignup(true)} />;
  }

  // If user is authenticated but hasn't completed profile setup, show profile setup page first
  if (user && (!user.firstName || !user.lastName)) {
    return <ProfileSetupPage />;
  }

  // If user has profile but no approved roles, show pending approval page
  if (user && userRoles.length === 0) {
    return <PendingApprovalPage />;
  }

  // Render current page with AppLayout wrapper
  const renderPage = () => {
    switch (currentPage) {
      case "class-management":
        return <ClassManagementPage />;
      case "students":
        return <StudentsPage />;
      case "pending-approvals":
        return <PendingApprovalsPage />;
      case "user-management":
        return <UserManagementPage />;
      case "user-list":
        return <UserListPage />;
      case "profile-settings":
        return <ProfileSettingsPage />;
      default:
        return <SchedulePage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <AppLayout onNavigate={setCurrentPage} currentPage={currentPage}>
      {renderPage()}
    </AppLayout>
  );
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
