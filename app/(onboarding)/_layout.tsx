// Import Stack from expo-router
// Stack is used to create stack-based navigation (push / pop screens)
import { Stack } from "expo-router";

// This layout wraps all screens inside the (onboarding) route group
export default function OnboardingLayout() {

  // Return a Stack navigator
  // screenOptions applies to ALL screens under (onboarding)
  return (
    <Stack
      // headerShown: false means we hide the default navigation header
      // because we design our own headers inside the screens
      screenOptions={{ headerShown: false }}
    />
  );
}
/*This file defines the layout for the onboarding flow of the app.
It uses a Stack navigator from expo-router to manage navigation between
onboarding screens, and hides the default header for a custom design.
*/