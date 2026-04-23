'use client';

/** @deprecated No-op — `SessionProvider` is in `app/layout.tsx`. Kept to avoid churn in parent imports. */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
