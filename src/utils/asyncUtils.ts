// Utility functions for handling async operations and race conditions
import { useRef, useState, useCallback, useEffect } from "react";

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const attempt = async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          reject(error);
        } else {
          setTimeout(attempt, delay * attempts);
        }
      }
    };

    attempt();
  });
}

export function createCancellableOperation<T>() {
  const controller = new AbortController();

  return {
    controller,
    execute: async (operation: () => Promise<T>): Promise<T> => {
      if (controller.signal.aborted) {
        throw new Error("Operation was cancelled");
      }

      return new Promise((resolve, reject) => {
        const abortHandler = () => {
          reject(new Error("Operation was cancelled"));
        };

        controller.signal.addEventListener("abort", abortHandler);

        operation()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            controller.signal.removeEventListener("abort", abortHandler);
          });
      });
    },
    cancel: () => controller.abort(),
  };
}

// Hook for managing loading states with timeout protection
export function useLoadingWithTimeout(timeoutMs: number = 10000) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setHasTimedOut(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setHasTimedOut(true);
      setIsLoading(false);
    }, timeoutMs);
  }, [timeoutMs]);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setHasTimedOut(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isLoading, hasTimedOut, startLoading, stopLoading };
}
