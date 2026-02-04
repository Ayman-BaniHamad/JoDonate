// Import Ionicons icon component (used for icons like mail, lock, arrow)
import { Ionicons } from "@expo/vector-icons";

// Import router hook from expo-router to navigate between screens/routes
import { useRouter } from "expo-router";

// Import React + useState hook to manage component state (email/password/loading/etc.)
import React, { useState } from "react";

// Import React Native UI components used in the screen
import {
  Keyboard, // used to dismiss the keyboard programmatically
  KeyboardAvoidingView, // moves UI up when keyboard opens (especially iOS)
  Platform, // to detect iOS/Android and apply platform-specific behavior
  Pressable, // button-like component with press handling
  StyleSheet, // for styling
  Text, // to show text
  TextInput, // input fields
  TouchableWithoutFeedback, // wrapper to detect taps (used to dismiss keyboard)
  View, // layout container
} from "react-native";

// Import Firebase Auth function to sign in with email/password
import { signInWithEmailAndPassword } from "firebase/auth";

// Import the initialized Firebase auth instance from your firebase.ts
import { auth } from "@/lib/firebase";

// Export the screen component as default (expo-router uses file name as route)
export default function SignInScreen() {
  // Create a router instance so we can navigate to other routes
  const router = useRouter();

  // State: stores the current email typed by the user
  const [email, setEmail] = useState("");

  // State: stores the current password typed by the user
  const [password, setPassword] = useState("");

  // State: true while we are waiting for Firebase sign-in result
  const [loading, setLoading] = useState(false);

  // State: holds an error message string to show to the user (or null if no error)
  const [error, setError] = useState<string | null>(null);

  // Function called when user presses the sign-in button
  const onSignIn = async () => {
    // Clear any previous error before trying again
    setError(null);

    // Remove extra spaces from email (common user typing issue)
    const cleanEmail = email.trim();

    // Validation: if email is empty OR password is empty -> show error and stop
    if (!cleanEmail || !password.trim()) {
      // Set error text to show under inputs
      setError("Please enter email and password.");
      // Exit function early so we don't call Firebase with empty values
      return;
    }

    try {
      // Start loading (used to disable button + show visual feedback)
      setLoading(true);

      // Firebase Authentication:
      // checks email/password, and if correct it signs the user in
      await signInWithEmailAndPassword(auth, cleanEmail, password);

      // If sign-in succeeded:
      // router.replace removes onboarding screen from back history
      // so user can't go back to sign-in screen with back button
      router.replace("/(private)");
    } catch (e: any) {
      // If sign-in fails, Firebase throws an error with a code
      // We convert common codes into friendly messages

      if (e?.code === "auth/invalid-credential") setError("Wrong email or password.");
      else if (e?.code === "auth/user-not-found") setError("No account found for this email.");
      else if (e?.code === "auth/wrong-password") setError("Wrong email or password.");
      else if (e?.code === "auth/invalid-email") setError("Invalid email address.");
      else setError("Sign in failed. Please try again.");
    } finally {
      // Stop loading whether success or error
      setLoading(false);
    }
  };

  // UI rendering
  return (
    // When user taps anywhere outside inputs, dismiss keyboard
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {/* Moves UI up when keyboard opens (better UX on iOS) */}
      <KeyboardAvoidingView
        // Apply screen style (full background)
        style={styles.screen}
        // Only iOS needs padding behavior usually
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Main container */}
        <View style={styles.container}>
          {/* Page title */}
          <Text style={styles.title}>Sign In</Text>

          {/* Card that contains input fields */}
          <View style={styles.card}>
            {/* Email row */}
            <View style={styles.inputRow}>
              {/* Email icon */}
              <Ionicons name="mail-outline" size={18} color={stylesVars.icon} />
              {/* Email input */}
              <TextInput
                // Input styling
                style={styles.input}
                // Placeholder text shown when empty
                placeholder="Email Address"
                // Placeholder color
                placeholderTextColor={stylesVars.placeholder}
                // Prevent auto-capitalization (emails should be lowercase)
                autoCapitalize="none"
                // Shows email keyboard layout
                keyboardType="email-address"
                // Input value bound to state
                value={email}
                // Updates state on typing
                onChangeText={setEmail}
              />
            </View>

            {/* Password row */}
            <View style={styles.inputRow}>
              {/* Lock icon */}
              <Ionicons name="lock-closed-outline" size={18} color={stylesVars.icon} />
              {/* Password input */}
              <TextInput
                // Input styling
                style={styles.input}
                // Placeholder
                placeholder="Password"
                // Placeholder color
                placeholderTextColor={stylesVars.placeholder}
                // Hides text as dots for security
                secureTextEntry
                // Bound to state
                value={password}
                // Updates state
                onChangeText={setPassword}
              />
            </View>
          </View>

          {/* If there is an error, show it; otherwise render nothing */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Sign-in button */}
          <Pressable
            // Call onSignIn when pressed
            onPress={onSignIn}
            // Disable button while loading to prevent multiple sign-ins
            disabled={loading}
            // Combine default style + reduce opacity during loading
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          >
            {/* Arrow icon inside the button */}
            <Ionicons name="arrow-forward" size={22} color={stylesVars.btnIcon} />
          </Pressable>

          {/* Footer row for sign-up navigation */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account?</Text>

            {/* Button that navigates to sign-up screen */}
            <Pressable onPress={() => router.push("/sign-up")}>
              <Text style={styles.footerLink}> Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// Central place for colors used in this screen
const stylesVars = {
  bg: "#4F98DC", // background blue
  text: "#FFFFFF", // white text
  card: "#FFFFFF", // white card background
  placeholder: "#4F98DC", // placeholder blue
  icon: "#4F98DC", // icon blue
  btn: "#FFFFFF", // white button background
  btnIcon: "#4F98DC", // button icon color
  shadow: "#4F98DC", // shadow color (blue)
};

// Stylesheet for the screen
const styles = StyleSheet.create({
  // Full screen background
  screen: {
    flex: 1, // takes full available space
    backgroundColor: stylesVars.bg, // background blue
  },

  // Main container inside screen
  container: {
    flex: 1, // full height
    paddingHorizontal: 22, // side padding
    paddingTop: 80, // top spacing (push content down)
    alignItems: "center", // center horizontally
  },

  // Title style
  title: {
    color: stylesVars.text, // white
    fontSize: 34, // big
    fontWeight: "800", // bold
    marginBottom: 28, // spacing under title
  },

  // Card around inputs
  card: {
    width: "100%", // full width
    borderRadius: 18, // rounded corners
    padding: 14, // inside spacing
    backgroundColor: stylesVars.card, // white background
    shadowColor: stylesVars.shadow, // shadow color
    shadowOpacity: 1, // strong shadow
    shadowRadius: 12, // blur radius
    shadowOffset: { width: 0, height: 8 }, // shadow drop
    elevation: 6, // Android shadow
  },

  // Row containing icon + input
  inputRow: {
    flexDirection: "row", // horizontal layout
    alignItems: "center", // vertically centered
    backgroundColor: "rgba(0,0,0,0.04)", // light gray background
    borderRadius: 14, // rounded corners
    paddingHorizontal: 12, // padding left/right
    height: 52, // fixed height
    marginBottom: 12, // spacing between rows
  },

  // Input styling
  input: {
    flex: 1, // take remaining space in row
    marginLeft: 10, // spacing from icon
    fontSize: 15, // text size
    color: "rgba(0,0,0,0.75)", // dark text color
  },

  // Error text styling
  errorText: {
    marginTop: 10, // spacing above
    color: "#E53935", // red
    fontWeight: "800", // bold
    fontSize: 13, // small
  },

  // Circular sign-in button
  primaryBtn: {
    marginTop: 16, // space from inputs
    width: 180, // button width
    height: 54, // button height
    borderRadius: 999, // fully rounded
    alignItems: "center", // center icon horizontally
    justifyContent: "center", // center icon vertically
    backgroundColor: stylesVars.btn, // white background
    shadowColor: stylesVars.shadow, // blue shadow
    shadowOpacity: 1, // shadow opacity
    shadowRadius: 10, // blur radius
    shadowOffset: { width: 0, height: 6 }, // shadow offset
    elevation: 5, // Android shadow
  },

  // Footer row at bottom
  footerRow: {
    position: "absolute", // absolute positioning
    bottom: 40, // distance from bottom
    flexDirection: "row", // horizontal text
    alignItems: "center", // vertically aligned
  },

  // Footer normal text
  footerText: {
    color: stylesVars.text, // white
    fontSize: 14, // small
    opacity: 0.95, // slightly transparent
  },

  // Footer link text
  footerLink: {
    color: stylesVars.text, // white
    fontSize: 14, // small
    fontWeight: "800", // bold
    textDecorationLine: "underline", // underline to look like link
  },
});
/* This file implements the Sign-In screen for the app.
It allows users to enter their email and password to sign in using Firebase Authentication.
The screen includes input validation, error handling, and navigation to the sign-up screen.
It also manages loading state to prevent multiple sign-in attempts.
*/