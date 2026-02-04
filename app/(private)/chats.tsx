import React from "react"; 
// Import React to define a functional component

import { View, Text, StyleSheet, Pressable, Platform } from "react-native"; 
// Import core React Native components:
// View → container
// Text → text rendering
// StyleSheet → styles definition
// Pressable → tappable button
// Platform → detect iOS vs Android

import { Ionicons } from "@expo/vector-icons"; 
// Import Ionicons icon set from Expo

import { useRouter } from "expo-router"; 
// Import router hook to navigate between screens

export default function ChatsScreen() { 
// Define and export the Chats screen component

  const router = useRouter(); 
  // Initialize router for navigation actions (back, push, replace, etc.)

  return ( 
    // Start rendering UI

    <View style={styles.screen}> 
      {/* Root screen container */}

      <View style={styles.header}> 
        {/* Header section */}

        <Pressable 
          onPress={() => router.back()} 
          // Navigate back to previous screen when pressed
          hitSlop={12} 
          // Increase touch area for better usability
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" /> 
          {/* Back arrow icon */}
        </Pressable>

        <Text style={styles.headerTitle}>Chats</Text> 
        {/* Screen title */}

        <View style={{ width: 34 }} /> 
        {/* Empty spacer to keep title centered */}
      </View>

      <View style={styles.card}> 
        {/* Card container for "Coming Soon" message */}

        <Ionicons name="chatbubbles-outline" size={44} color="#FFFFFF" /> 
        {/* Chat icon */}

        <Text style={styles.title}>Chats Feature Coming Soon</Text> 
        {/* Main message */}

        <Text style={styles.sub}>
          {/* Explanation text */}
          This feature will allow donors and requesters to communicate and agree on delivery details.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Define all styles used in this screen

  screen: {
    flex: 1, 
    // Screen takes full height

    backgroundColor: "#4F98DC", 
    // App’s main blue color

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
    // Space between back button, title, spacer
  },

  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 999, 
    // Circular button

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
    padding: 18,

    backgroundColor: "rgba(255,255,255,0.16)", 
    // Semi-transparent card

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",

    alignItems: "center", 
    // Center content horizontally
  },

  title: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  sub: {
    marginTop: 8,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
});
/*
The function of this file is to display a "Chats" screen in the app, which currently shows a "Coming Soon" message. 
It includes a header with a back button and title, and a card with an icon and text explaining that the chat feature will allow donors and requesters to communicate about delivery details. 
The screen is styled with the app's main blue color and uses semi-transparent cards for content.
*/