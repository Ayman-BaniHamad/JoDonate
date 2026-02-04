import React from "react";
// Import React to define a functional component

import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
// View: container component
// Text: display text
// StyleSheet: define styles
// Pressable: clickable/tappable component
// Platform: detect iOS vs Android (for padding differences)

import { Ionicons } from "@expo/vector-icons";
// Icon library used for UI icons (back arrow)

import { useRouter } from "expo-router";
// Hook to control navigation (back, push, replace)

export default function SettingsScreen() {
// Define and export the Settings screen component

  const router = useRouter();
// Initialize the router to handle navigation actions

  return (
    <View style={styles.screen}>
      {/* Root container for the whole screen */}

      <View style={styles.header}>
        {/* Header section at the top */}

        <Pressable
          onPress={() => router.back()}
          // When pressed, navigate back to the previous screen
          hitSlop={12}
          // Increase clickable area for better UX
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          {/* Back arrow icon */}
        </Pressable>

        <Text style={styles.headerTitle}>Settings</Text>
        {/* Screen title */}

        <View style={{ width: 34 }} />
        {/* Spacer to keep the title centered */}
      </View>

      <View style={styles.card}>
        {/* Card container for the content */}

        <Text style={styles.title}>Coming soon</Text>
        {/* Main message */}

        <Text style={styles.sub}>
          {/* Description text */}
          We’ll add settings like editing profile info and preferences here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // All styles used in this screen

  screen: {
    flex: 1,
    // Take full screen height

    backgroundColor: "#4F98DC",
    // Main app background color

    paddingTop: Platform.OS === "ios" ? 54 : 18,
    // Extra padding for iOS status bar

    paddingHorizontal: 16,
    // Horizontal padding
  },

  header: {
    height: 54,
    // Fixed header height

    flexDirection: "row",
    // Arrange items horizontally

    alignItems: "center",
    // Vertically center items

    justifyContent: "space-between",
    // Space between back button, title, and spacer
  },

  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    // Circular back button

    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  card: {
    marginTop: 14,
    // Space below header

    borderRadius: 18,
    padding: 16,

    backgroundColor: "rgba(255,255,255,0.16)",
    // Semi-transparent card background

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },

  sub: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
    lineHeight: 20,
  },
});
