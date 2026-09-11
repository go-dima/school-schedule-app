import React from "react";
import { Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router-dom";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundaryClass extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent error={this.state.error!} reset={this.reset} />
        );
      }

      return (
        <DefaultErrorFallback error={this.state.error!} reset={this.reset} />
      );
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const { t } = useTranslation();

  const handleRefresh = () => {
    reset();
    window.location.reload();
  };

  return (
    <div
      style={{
        padding: "50px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
      }}>
      <Result
        status="error"
        title={t("errors.boundary.title", "Something went wrong")}
        subTitle={
          process.env.NODE_ENV === "development"
            ? error.message
            : t(
                "errors.boundary.subtitle",
                "An unexpected error occurred. Please try refreshing the page."
              )
        }
        extra={[
          <Button type="primary" key="retry" onClick={reset}>
            {t("errors.boundary.tryAgain", "Try Again")}
          </Button>,
          <Button key="refresh" onClick={handleRefresh}>
            {t("errors.boundary.refresh", "Refresh Page")}
          </Button>,
        ]}
      />
    </div>
  );
}

function RouteErrorFallback() {
  const { t } = useTranslation();
  const error = useRouteError();

  if (process.env.NODE_ENV === "development") {
    console.error("Route Error:", error);
  }

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div
      style={{
        padding: "50px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
      }}>
      <Result
        status="error"
        title={t("errors.boundary.title", "Something went wrong")}
        subTitle={t(
          "errors.boundary.subtitle",
          "An unexpected error occurred. Please try refreshing the page."
        )}
        extra={[
          <Button type="primary" key="refresh" onClick={handleRefresh}>
            {t("errors.boundary.refresh", "Refresh Page")}
          </Button>,
        ]}
      />
    </div>
  );
}

export { RouteErrorFallback };

// Context Error Boundary specifically for auth/context issues
export function ContextErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log context-specific errors
    console.error("Context Error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  };

  const fallback = ({
    error: _error,
    reset: _reset,
  }: {
    error: Error;
    reset: () => void;
  }) => {
    const { t } = useTranslation();

    return (
      <div
        style={{
          padding: "50px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}>
        <Result
          status="error"
          title={t("errors.context.title", "Authentication Error")}
          subTitle={t(
            "errors.context.subtitle",
            "There was a problem with authentication. Please try logging in again."
          )}
          extra={[
            <Button
              type="primary"
              key="login"
              onClick={() => (window.location.href = "/login")}>
              {t("errors.context.login", "Go to Login")}
            </Button>,
            <Button key="refresh" onClick={() => window.location.reload()}>
              {t("errors.context.refresh", "Refresh Page")}
            </Button>,
          ]}
        />
      </div>
    );
  };

  return (
    <ErrorBoundaryClass fallback={fallback} onError={handleError}>
      {children}
    </ErrorBoundaryClass>
  );
}

export default ErrorBoundaryClass;
