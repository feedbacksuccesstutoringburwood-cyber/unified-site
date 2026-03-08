import { useEffect } from 'react';

/**
 * Client-side convenience guard.
 *
 * The app is primarily protected by Next.js middleware (server-side),
 * so this hook intentionally does NOT hard-redirect (to avoid edge cases
 * with cookies / localStorage / private browsing).
 *
 * It's kept here because some pages import it; removing it would break builds.
 */
export default function useAuthGuard() {
  useEffect(() => {
    // No-op: middleware handles auth.
  }, []);
}
