import { useEffect, useRef, type ReactNode } from "react";

// Pages call Supabase-backed services (`xApi.method()`). A story swaps those
// methods for fixtures while it is mounted, so no network call happens.
// `patches` is a list of [service object, method name, replacement].
type Patch = [Record<string, any>, string, (...args: any[]) => any];

export function StubbedApis({
  patches,
  children,
}: {
  patches: Patch[];
  children: ReactNode;
}) {
  // The real methods, captured once at the first render.
  const originals = useRef<unknown[] | null>(null);
  if (originals.current === null) {
    originals.current = patches.map(([target, key]) => target[key]);
  }

  const install = () =>
    patches.forEach(([target, key, replacement]) => {
      target[key] = replacement;
    });
  const restore = () =>
    patches.forEach(([target, key], i) => {
      target[key] = originals.current![i];
    });

  // Installed during render so the stubs are in place before the page's own
  // mount effects fetch, then re-installed (StrictMode re-runs effects) and
  // restored on unmount.
  install();
  useEffect(() => {
    install();
    return restore;
  }, []);
  return <>{children}</>;
}
