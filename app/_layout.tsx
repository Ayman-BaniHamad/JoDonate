import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/lib/auth-context";

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const group = segments[0]; // "(onboarding)" or "(private)"
    const inOnboarding = group === "(onboarding)";
    const inPrivate = group === "(private)";

    if (user && inOnboarding) {
      router.replace("/(private)");
    } else if (!user && inPrivate) {
      router.replace("/(onboarding)");
    }
  }, [user, loading, segments, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthGate />

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(private)" />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>

        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
