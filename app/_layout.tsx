// Import built-in navigation themes (dark/light) and ThemeProvider wrapper
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";

// Import expo-router navigation stack + hooks to control routing & detect current route group
import { Stack, useRouter, useSegments } from "expo-router";

// Import status bar control (top phone status bar)
import { StatusBar } from "expo-status-bar";

// React hook used for running logic when values change (side effects)
import { useEffect } from "react";

// Required import for react-native-reanimated (Expo requires it to be loaded once globally)
import "react-native-reanimated";

// Custom hook that detects the phone's color scheme: "light" or "dark"
import { useColorScheme } from "@/hooks/use-color-scheme";

// AuthProvider wraps the whole app with auth state (user + loading)
// useAuth lets us read that state anywhere
import { AuthProvider, useAuth } from "@/lib/auth-context";

// This component acts as a "security gate":
// It redirects users depending on whether they are logged in or not.
function AuthGate() {
  // Get the logged-in user (or null) and loading flag from the auth context
  const { user, loading } = useAuth();

  // Get the current route segments from expo-router
  // Example: ["(private)", "index"] or ["(onboarding)", "index"]
  const segments = useSegments();

  // Router object used to navigate programmatically
  const router = useRouter();

  // Run this logic whenever auth state OR route location changes
  useEffect(() => {
    // If Firebase is still checking if user is logged in, do nothing yet
    if (loading) return;

    // segments[0] represents the top-level route group:
    // It will be "(onboarding)" or "(private)"
    const group = segments[0]; // "(onboarding)" or "(private)"

    // True if user is currently inside onboarding screens (sign-in/sign-up)
    const inOnboarding = group === "(onboarding)";

    // True if user is currently inside private (protected) screens
    const inPrivate = group === "(private)";

    // If the user IS logged in AND currently on onboarding,
    // we redirect them to the private home screen.
    if (user && inOnboarding) {
      router.replace("/(private)");
    }
    // If the user is NOT logged in AND trying to access private screens,
    // we force them back to onboarding.
    else if (!user && inPrivate) {
      router.replace("/(onboarding)");
    }

    // This dependency array means:
    // rerun when these values change (auth state or route)
  }, [user, loading, segments, router]);

  // This component renders nothing.
  // It only exists to run the redirect logic above.
  return null;
}

// This is the main root layout for the entire app
export default function RootLayout() {
  // Detect whether the device is in dark mode or light mode
  const colorScheme = useColorScheme();

  // Render the navigation structure of the whole app
  return (
    // Wrap the entire app in AuthProvider so all screens can access user/loading state
    <AuthProvider>
      {/* Wrap navigation with a theme provider so navigation colors match light/dark mode */}
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        {/* AuthGate runs redirect logic to protect private routes */}
        <AuthGate />

        {/* Stack navigation defines all route groups/screens */}
        <Stack screenOptions={{ headerShown: false }}>
          {/* Route group for onboarding screens (sign-in, sign-up, etc.) */}
          <Stack.Screen name="(onboarding)" />

          {/* Route group for private screens (home, profile, add-item, etc.) */}
          <Stack.Screen name="(private)" />

          {/* Optional modal screen (if you use modal routes) */}
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>

        {/* Status bar style automatically adjusts based on theme */}
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
/*This file is the root layout of the app.
It sets up global navigation theming, authentication state management,
and route protection to ensure only logged-in users can access private screens.
*/