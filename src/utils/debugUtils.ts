// Development utilities for debugging loading states and race conditions
import { useRef, useCallback, useEffect } from "react";

const isDevelopment = process.env.NODE_ENV === "development";

interface LoadingOperation {
  id: string;
  name: string;
  startTime: number;
  component?: string;
}

class LoadingStateDebugger {
  private operations = new Map<string, LoadingOperation>();
  private longRunningThreshold = 5000; // 5 seconds
  private checkInterval: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (isDevelopment) {
      this.startMonitoring();
    }
  }

  startOperation(name: string, component?: string): string {
    if (!isDevelopment) return "";

    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const operation: LoadingOperation = {
      id,
      name,
      component,
      startTime: Date.now(),
    };

    this.operations.set(id, operation);
    console.log(
      `🔄 Loading started: ${name}${component ? ` (${component})` : ""}`,
      { id }
    );

    return id;
  }

  endOperation(id: string) {
    if (!isDevelopment || !id) return;

    const operation = this.operations.get(id);
    if (operation) {
      const duration = Date.now() - operation.startTime;
      const emoji = duration > this.longRunningThreshold ? "⚠️" : "✅";

      console.log(
        `${emoji} Loading completed: ${operation.name}${operation.component ? ` (${operation.component})` : ""} - ${duration}ms`,
        { id }
      );
      this.operations.delete(id);
    }
  }

  failOperation(id: string, error: Error) {
    if (!isDevelopment || !id) return;

    const operation = this.operations.get(id);
    if (operation) {
      const duration = Date.now() - operation.startTime;
      console.error(
        `❌ Loading failed: ${operation.name}${operation.component ? ` (${operation.component})` : ""} - ${duration}ms`,
        {
          id,
          error: error.message,
          stack: error.stack,
        }
      );
      this.operations.delete(id);
    }
  }

  private startMonitoring() {
    this.checkInterval = setInterval(() => {
      const now = Date.now();

      for (const [id, operation] of this.operations) {
        const duration = now - operation.startTime;

        if (duration > this.longRunningThreshold) {
          console.warn(
            `⏱️ Long-running operation detected: ${operation.name}${operation.component ? ` (${operation.component})` : ""} - ${duration}ms`,
            {
              id,
              operation,
              suggestion:
                "Consider adding timeout protection or checking for race conditions",
            }
          );
        }
      }
    }, 2000);
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.operations.clear();
  }

  getActiveOperations() {
    return Array.from(this.operations.values());
  }
}

export const loadingDebugger = new LoadingStateDebugger();

// React hook for debugging loading states
export function useLoadingDebug(operationName: string, component?: string) {
  const idRef = useRef<string>("");

  const startLoading = useCallback(() => {
    if (idRef.current) {
      loadingDebugger.endOperation(idRef.current);
    }
    idRef.current = loadingDebugger.startOperation(operationName, component);
  }, [operationName, component]);

  const endLoading = useCallback(() => {
    if (idRef.current) {
      loadingDebugger.endOperation(idRef.current);
      idRef.current = "";
    }
  }, []);

  const failLoading = useCallback((error: Error) => {
    if (idRef.current) {
      loadingDebugger.failOperation(idRef.current, error);
      idRef.current = "";
    }
  }, []);

  useEffect(() => {
    return () => {
      if (idRef.current) {
        loadingDebugger.endOperation(idRef.current);
      }
    };
  }, []);

  return { startLoading, endLoading, failLoading };
}

// Helper for adding debug info to console in development
export function debugLog(message: string, data?: any) {
  if (isDevelopment) {
    console.log(`🐛 [DEBUG] ${message}`, data);
  }
}

export function debugWarn(message: string, data?: any) {
  if (isDevelopment) {
    console.warn(`⚠️ [DEBUG] ${message}`, data);
  }
}

export function debugError(message: string, error?: any) {
  if (isDevelopment) {
    console.error(`❌ [DEBUG] ${message}`, error);
  }
}

// Performance monitoring for race conditions
export function measureAsyncOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return operation()
    .then(result => {
      const duration = performance.now() - startTime;
      debugLog(
        `Async operation "${name}" completed in ${duration.toFixed(2)}ms`
      );
      return result;
    })
    .catch(error => {
      const duration = performance.now() - startTime;
      debugError(
        `Async operation "${name}" failed after ${duration.toFixed(2)}ms`,
        error
      );
      throw error;
    });
}
