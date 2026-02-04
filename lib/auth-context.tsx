// Import Firebase authentication listener and User type
// onAuthStateChanged: listens for login / logout changes
// User: Firebase user object type
import { onAuthStateChanged, User } from "firebase/auth";

// Import React utilities
// createContext: creates a global context
// useContext: allows components to access the context
// useEffect: runs side effects (auth listener)
// useMemo: optimizes re-renders
// useState: manages local state
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Import initialized Firebase Auth instance
import { auth } from "@/lib/firebase";

// Define the shape of authentication state
// user: currently logged-in user (or null if logged out)
// loading: true while Firebase is checking auth state
type AuthState = {
  user: User | null;
  loading: boolean;
};

// Create the authentication context
// Default value is user = null and loading = true
// This is used before Firebase finishes checking auth state
const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
});

// AuthProvider wraps the entire app
// It provides auth state (user + loading) to all components
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Holds the currently authenticated user
  const [user, setUser] = useState<User | null>(null);

  // Indicates whether auth state is still being determined
  const [loading, setLoading] = useState(true);

  // Listen for authentication state changes
  useEffect(() => {
    // onAuthStateChanged runs whenever user logs in or logs out
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);       // u is either a User object or null
      setLoading(false); // Auth state has been resolved
    });

    // Cleanup listener when component unmounts
    return unsub;
  }, []);

  // Memoize the context value to avoid unnecessary re-renders
  const value = useMemo(
    () => ({ user, loading }),
    [user, loading]
  );

  // Provide auth state to all children components
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to access authentication context easily
// Instead of importing useContext(AuthContext) everywhere
export function useAuth() {
  return useContext(AuthContext);
}
/*This file manages global authentication state in the app.
It listens to Firebase Authentication and provides the current user and loading status 
to all components
using React Context.
*/