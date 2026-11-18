import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isOnline: boolean;
  redirectError: string;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  signOutNow: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  return (
    /Macintosh/i.test(ua) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  );
}

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function formatFriendlyAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code || '';
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  const extractedCode =
    code || (rawMessage.match(/\((auth\/[a-z0-9-]+)\)/i)?.[1] ?? '');

  switch (extractedCode) {
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Redirecting to Google Sign-In...';
    case 'auth/popup-closed-by-user':
      return 'The Google Sign-In window was closed before finishing. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'A sign-in request is already in progress. Please try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google Sign-In. Please contact the platform administrator.';
    case 'auth/network-request-failed':
      return 'Network error while connecting to Google Sign-In. Please check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Please wait a moment and try again.';
    case 'auth/user-disabled':
      return 'This Google account has been disabled. Please contact support.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is currently not enabled for this project.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Sign-in is not supported in this browser mode. Please open the page in Safari or Chrome.';
    case 'auth/web-storage-unsupported':
      return 'Browser storage is disabled. Please allow cookies and site data to sign in.';
    case 'auth/internal-error':
      return 'Google Sign-In encountered a temporary error. Please try again.';
    default:
      if (rawMessage && !rawMessage.includes('Firebase:') && !rawMessage.includes('auth/')) {
        return rawMessage;
      }
      return 'Unable to sign in with Google right now. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [redirectError, setRedirectError] = useState('');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    let redirectSettled = false;

    const markReadyIfDone = () => {
      if (active && authEventReceived && redirectSettled) {
        setAuthReady(true);
      }
    };

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      authEventReceived = true;
      markReadyIfDone();
    });

    getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          setUser(result.user);
        }
      })
      .catch((err) => {
        if (!active) return;
        const code = (err as { code?: string } | null)?.code || '';
        if (code !== 'auth/cancelled-popup-request') {
          setRedirectError(formatFriendlyAuthError(err));
        }
      })
      .finally(() => {
        redirectSettled = true;
        markReadyIfDone();
      });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  function clearAuthError() {
    setRedirectError('');
  }

  function signInWithGoogle(): Promise<User | null> {
    setRedirectError('');
    const provider = createGoogleProvider();

    if (isMobileBrowser()) {
      return signInWithRedirect(auth, provider)
        .then(() => null)
        .catch((err) => {
          throw new Error(formatFriendlyAuthError(err));
        });
    }

    return signInWithPopup(auth, provider)
      .then((cred) => cred.user)
      .catch((err) => {
        const code = (err as { code?: string } | null)?.code || '';
        if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
          return signInWithRedirect(auth, createGoogleProvider())
            .then(() => null)
            .catch((redirectErr) => {
              throw new Error(formatFriendlyAuthError(redirectErr));
            });
        }
        throw new Error(formatFriendlyAuthError(err));
      });
  }

  async function signOutNow(): Promise<void> {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isOnline,
        redirectError,
        clearAuthError,
        signInWithGoogle,
        signOutNow,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
