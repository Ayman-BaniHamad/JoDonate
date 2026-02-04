// Import the Stack navigator from expo-router
// Stack is used to define a stack-based navigation (screens pushed on top of each other)
import { Stack } from "expo-router";

// This component defines the layout for all routes inside the (private) folder
// Any screen inside app/(private)/ will be rendered inside this layout
export default function PrivateLayout() {

  // We return a Stack navigator
  // This Stack controls navigation between private screens (home, profile, etc.)
  return (

    // Stack component from expo-router
    // screenOptions applies default options to ALL screens inside this stack
    <Stack
      screenOptions={{
        // headerShown: false
        // We disable the default header because:
        // 1) We design our own headers manually
        // 2) It gives us full UI control
        headerShown: false,
      }}
    />

  );
}
/* This file defines the layout for all private screens in the app.
It uses a Stack navigator from expo-router to manage navigation between screens like Home and Profile.
The default header is disabled to allow for custom-designed headers in each screen.
*/