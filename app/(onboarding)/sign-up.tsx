// Import Ionicons icon component (used for icons like person, mail, lock, arrow)
import { Ionicons } from "@expo/vector-icons";

// Import router hook from expo-router to navigate between screens/routes
import { useRouter } from "expo-router";

// Import React + useState hook to manage component state (name/email/password/loading/error)
import React, { useState } from "react";

// Import React Native UI components used in the sign-up screen
import {
  Keyboard, // used to dismiss the keyboard programmatically
  KeyboardAvoidingView, // shifts UI up when keyboard opens (especially iOS)
  Platform, // lets us detect iOS/Android and apply platform-specific behavior
  Pressable, // button-like component
  StyleSheet, // for styling
  Text, // to display text
  TextInput, // for user input fields
  TouchableWithoutFeedback, // wrapper to detect taps (used to dismiss keyboard)
  View, // layout container
} from "react-native";

// Import Firebase Auth function to create an account using email/password
import { createUserWithEmailAndPassword } from "firebase/auth";

// Import Firestore helpers:
// doc = reference a document path
// serverTimestamp = server-side time (reliable)
// setDoc = create/overwrite a document
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

// Import initialized Firebase instances (auth and Firestore db)
import { auth, db } from "@/lib/firebase";

// Export screen component as default (expo-router maps file to route)
export default function SignUpScreen() {
  // Router used for navigation after successful sign up
  const router = useRouter();

  // State: user's display name (stored in Firestore users collection)
  const [name, setName] = useState("");

  // State: user's email
  const [email, setEmail] = useState("");

  // State: user's password
  const [password, setPassword] = useState("");

  // State: true while request is running (disable button + show feedback)
  const [loading, setLoading] = useState(false);

  // State: error message (displayed in UI); null means no error
  const [error, setError] = useState<string | null>(null);

  // Function called when user presses Sign Up button
  const onSignUp = async () => {
    // Clear previous error
    setError(null);

    // Clean inputs (trim removes leading/trailing spaces)
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    // Validate name
    if (!cleanName) {
      setError("Please enter your name.");
      return; // stop execution if invalid
    }

    // Validate email and password
    if (!cleanEmail || !password.trim()) {
      setError("Please enter email and password.");
      return; // stop execution if invalid
    }

    try {
      // Start loading
      setLoading(true);

      // 1) Create account in Firebase Auth
      // This creates an auth user record and signs them in
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      // 2) Create user profile document in Firestore
      // We use the UID (unique ID) from Firebase Auth as the document ID
      const uid = cred.user.uid;

      // setDoc writes a document at users/{uid}
      // This stores profile info we need inside the app (like name)
      await setDoc(doc(db, "users", uid), {
        name: cleanName, // store the user's name
        email: cleanEmail, // store the user's email (optional because auth already has it)
        createdAt: serverTimestamp(), // server timestamp for consistent creation time
      });

      // After successful sign up, move user to private area
      // replace = prevents going back to sign up via back button
      router.replace("/(private)");
    } catch (e: any) {
      // If sign-up fails, Firebase returns an error code
      // Convert code into friendly message
      if (e?.code === "auth/email-already-in-use") setError("This email is already in use.");
      else if (e?.code === "auth/invalid-email") setError("Invalid email address.");
      else if (e?.code === "auth/weak-password")
        setError("Password should be at least 6 characters.");
      else setError("Sign up failed. Please try again.");
    } finally {
      // Stop loading whether success or error
      setLoading(false);
    }
  };

  // UI rendering
  return (
    // Tap anywhere outside inputs to dismiss keyboard
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {/* Adjusts UI for keyboard */}
      <KeyboardAvoidingView
        style={styles.screen} // background style
        behavior={Platform.OS === "ios" ? "padding" : undefined} // iOS uses padding behavior
      >
        {/* Main container */}
        <View style={styles.container}>
          {/* Screen title */}
          <Text style={styles.title}>Sign Up</Text>

          {/* Card that contains input fields */}
          <View style={styles.card}>
            {/* Name input row */}
            <View style={styles.inputRow}>
              {/* User icon */}
              <Ionicons name="person-outline" size={18} color={stylesVars.icon} />
              {/* Name input */}
              <TextInput
                style={styles.input} // styling
                placeholder="Name" // placeholder
                placeholderTextColor={stylesVars.placeholder} // placeholder color
                value={name} // bind to state
                onChangeText={setName} // update state on typing
              />
            </View>

            {/* Email input row */}
            <View style={styles.inputRow}>
              {/* Mail icon */}
              <Ionicons name="mail-outline" size={18} color={stylesVars.icon} />
              {/* Email input */}
              <TextInput
                style={styles.input} // styling
                placeholder="Enter your email" // placeholder
                placeholderTextColor={stylesVars.placeholder} // placeholder color
                autoCapitalize="none" // emails should not auto-capitalize
                keyboardType="email-address" // email keyboard layout
                value={email} // bind to state
                onChangeText={setEmail} // update state
              />
            </View>

            {/* Password input row */}
            <View style={styles.inputRow}>
              {/* Lock icon */}
              <Ionicons name="lock-closed-outline" size={18} color={stylesVars.icon} />
              {/* Password input */}
              <TextInput
                style={styles.input} // styling
                placeholder="Password" // placeholder
                placeholderTextColor={stylesVars.placeholder} // placeholder color
                secureTextEntry // hide password characters
                value={password} // bind to state
                onChangeText={setPassword} // update state
              />
            </View>
          </View>

          {/* If there is an error, show it; else show nothing */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Primary sign up button */}
          <Pressable
            onPress={onSignUp} // call sign up logic
            disabled={loading} // disable while loading
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]} // fade when loading
          >
            {/* Arrow icon */}
            <Ionicons name="arrow-forward" size={22} color={stylesVars.btnIcon} />
          </Pressable>

          {/* OR divider row */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          {/* Social login button (UI only currently; no logic implemented yet) */}
          <Pressable style={styles.socialBtn} onPress={() => {}}>
            <Text style={styles.socialText}>Continue with Google</Text>
          </Pressable>

          {/* Social login button (UI only currently; no logic implemented yet) */}
          <Pressable style={styles.socialBtn} onPress={() => {}}>
            <Text style={styles.socialText}>Continue with Facebook</Text>
          </Pressable>

          {/* Footer: navigate back to sign-in */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            {/* replace() so it doesn't stack onboarding routes */}
            <Pressable onPress={() => router.replace("/(onboarding)")}>
              <Text style={styles.footerLink}> Sign In</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// Colors used in this screen
const stylesVars = {
  bg: "#4F98DC", // background blue
  text: "#FFFFFF", // white text
  card: "#FFFFFF", // white card background
  placeholder: "#4F98DC", // placeholder color
  icon: "#4F98DC", // icon color
  btn: "#FFFFFF", // button background
  btnIcon: "#4F98DC", // button icon color
  shadow: "#4F98DC", // shadow color
};

// Styles
const styles = StyleSheet.create({
  // Full screen background
  screen: { flex: 1, backgroundColor: stylesVars.bg },

  // Container layout
  container: {
    flex: 1, // take full height
    paddingHorizontal: 22, // side padding
    paddingTop: 70, // top padding
    alignItems: "center", // center children horizontally
  },

  // Title styling
  title: {
    color: stylesVars.text, // white
    fontSize: 34, // large
    fontWeight: "800", // bold
    marginBottom: 26, // space below title
  },

  // Card wrapper for inputs
  card: {
    width: "100%", // full width
    borderRadius: 18, // rounded corners
    padding: 14, // inner spacing
    backgroundColor: stylesVars.card, // white background
    shadowColor: stylesVars.shadow, // shadow color
    shadowOpacity: 1, // shadow opacity
    shadowRadius: 12, // blur amount
    shadowOffset: { width: 0, height: 8 }, // shadow drop
    elevation: 6, // Android shadow
  },

  // Input row style (icon + input)
  inputRow: {
    flexDirection: "row", // horizontal layout
    alignItems: "center", // vertically centered
    backgroundColor: "rgba(0,0,0,0.04)", // light gray
    borderRadius: 14, // rounded corners
    paddingHorizontal: 12, // left/right padding
    height: 52, // fixed height
    marginBottom: 12, // spacing between rows
  },

  // Input text style
  input: {
    flex: 1, // take remaining space
    marginLeft: 10, // spacing from icon
    fontSize: 15, // text size
    color: "rgba(0,0,0,0.75)", // dark text
  },

  // Error message style
  errorText: {
    marginTop: 10, // spacing above
    color: "#E53935", // red
    fontWeight: "800", // bold
    fontSize: 13, // small
  },

  // Main sign up button style
  primaryBtn: {
    marginTop: 16, // spacing above
    width: 180, // width
    height: 54, // height
    borderRadius: 999, // fully rounded
    alignItems: "center", // center content
    justifyContent: "center", // center content
    backgroundColor: stylesVars.btn, // white
    shadowColor: stylesVars.shadow, // shadow color
    shadowOpacity: 1, // shadow opacity
    shadowRadius: 10, // blur
    shadowOffset: { width: 0, height: 6 }, // offset
    elevation: 5, // Android shadow
  },

  // OR row container
  orRow: {
    width: "100%", // full width
    flexDirection: "row", // horizontal
    alignItems: "center", // centered vertically
    marginTop: 18, // spacing above
    marginBottom: 14, // spacing below
  },

  // OR separator line
  orLine: {
    flex: 1, // take equal space left/right
    height: 1, // thin line
    backgroundColor: "rgba(255,255,255,0.55)", // semi-transparent white
  },

  // OR text
  orText: {
    color: stylesVars.text, // white
    marginHorizontal: 10, // spacing left/right
    fontWeight: "700", // semi-bold
    opacity: 0.9, // slightly transparent
  },

  // Social button style (UI-only)
  socialBtn: {
    width: "100%", // full width
    height: 52, // height
    borderRadius: 999, // rounded
    backgroundColor: "rgba(255,255,255,0.95)", // almost white
    alignItems: "center", // center text
    justifyContent: "center", // center text
    marginBottom: 12, // spacing between buttons
    shadowColor: stylesVars.shadow, // shadow color
    shadowOpacity: 1, // shadow opacity
    shadowRadius: 10, // blur
    shadowOffset: { width: 0, height: 6 }, // offset
    elevation: 4, // Android shadow
  },

  // Social button text
  socialText: {
    color: "rgba(0,0,0,0.8)", // dark text
    fontWeight: "700", // bold-ish
  },

  // Footer at bottom
  footerRow: {
    position: "absolute", // fixed to bottom
    bottom: 34, // distance from bottom
    flexDirection: "row", // horizontal
    alignItems: "center", // align text
  },

  // Footer text
  footerText: {
    color: stylesVars.text, // white
    fontSize: 14, // size
    opacity: 0.95, // slight transparency
  },

  // Footer link text
  footerLink: {
    color: stylesVars.text, // white
    fontSize: 14, // size
    fontWeight: "800", // bold
    textDecorationLine: "underline", // underline to look like link
  },
});
/* This file implements the Sign-Up screen for the app.
It allows users to create an account using their name, email, and password via Firebase Authentication.
The screen includes input validation, error handling, and navigation to the private area upon successful sign-up.
It also manages loading state to prevent multiple sign-up attempts.
*/