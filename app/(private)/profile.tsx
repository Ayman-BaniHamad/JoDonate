import { Ionicons } from "@expo/vector-icons";
// Import icon set used across the UI (profile icon, back icon, camera icon, etc.)

import * as ImagePicker from "expo-image-picker";
// Expo library that lets the user pick an image from the phone gallery (for avatar upload)

import { useRouter } from "expo-router";
// Expo Router hook used for navigation (push/back/replace)

import { signOut } from "firebase/auth";
// Firebase Auth function to log the user out

import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
// Firestore imports:
// collection(): points to a collection
// doc(): points to a document reference
// onSnapshot(): real-time listener
// query(): build Firestore query
// updateDoc(): update an existing document
// where(): filter query results

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
// Firebase Storage imports:
// ref(): create a storage reference/path
// uploadBytes(): upload file data
// getDownloadURL(): get a public URL for uploaded file

import React, { useEffect, useState } from "react";
// React + hooks:
// useState for state variables
// useEffect for running side effects (listeners, subscriptions)

import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
// React Native UI components:
// Alert: popup dialog
// Image: show avatar image
// Platform: detect iOS/Android differences
// Pressable: clickable UI element
// StyleSheet: define styles
// Text/View: layout and labels

import { auth, db, storage } from "@/lib/firebase";
// Import your initialized Firebase instances (Auth, Firestore, Storage)

export default function ProfileScreen() {
// Define and export Profile screen component

  const router = useRouter();
  // Router instance for navigation

  const firebaseUser = auth.currentUser;
  // Current signed-in user from Firebase Auth (or null if not signed in)

  const [name, setName] = useState<string>("Loading...");
  // State: user display name (default shown while loading)

  const [avatarUrl, setAvatarUrl] = useState<string>("");
  // State: avatar URL stored in Firestore (empty means no avatar yet)

  const email = firebaseUser?.email ?? "No email";
  // Read email from Auth user; fallback if missing

  const [stats, setStats] = useState({
    listed: 0,
    donated: 0,
    requests: 0, // pending received
  });
  // State: profile stats
  // listed: total items listed by this user
  // donated: how many items were marked as donated
  // requests: how many pending requests received for the user’s items

  // ✅ Live user profile (name + avatarUrl)
  useEffect(() => {
  // useEffect runs when the user changes (firebaseUser?.uid dependency below)

    if (!firebaseUser) {
    // If not signed in, reset data to defaults

      setName("Unknown User");
      // Set fallback name

      setAvatarUrl("");
      // Clear avatar URL

      return;
      // Stop here because we can't listen without a user id
    }

    const userRef = doc(db, "users", firebaseUser.uid);
    // Firestore reference to users/{uid}

    const unsub = onSnapshot(
    // Create a real-time listener to the user document

      userRef,
      // The document to listen to

      (snap) => {
      // Callback: triggered every time the user doc changes

        if (!snap.exists()) {
        // If the doc doesn't exist (shouldn't happen normally), set fallback

          setName("User");
          // fallback name

          setAvatarUrl("");
          // fallback avatar

          return;
          // stop processing
        }

        const data = snap.data() as any;
        // Read document fields (typed as any for simplicity)

        setName(data?.name ?? "User");
        // Update name from Firestore field "name"

        setAvatarUrl(data?.avatarUrl ?? "");
        // Update avatar URL from Firestore field "avatarUrl"
      },

      (err) => {
      // Error callback: if snapshot listener fails

        console.log("Profile user doc error:", err);
        // Log error for debugging

        setName("User");
        // fallback name on error

        setAvatarUrl("");
        // fallback avatar on error
      },
    );

    return unsub;
    // Cleanup: unsubscribe listener when component unmounts or uid changes
  }, [firebaseUser?.uid]);
  // Dependency: rerun this effect only when the user ID changes

  // ✅ Live stats
  useEffect(() => {
  // Another effect for real-time stats based on items and requests

    if (!firebaseUser) return;
    // If no user is signed in, do nothing

    const itemsListedQ = query(
    // Query: all items where ownerId == current user uid

      collection(db, "items"),
      // items collection

      where("ownerId", "==", firebaseUser.uid),
      // filter items that belong to user
    );

    const itemsDonatedQ = query(
    // Query: items that belong to user AND have status "donated"

      collection(db, "items"),
      // items collection

      where("ownerId", "==", firebaseUser.uid),
      // filter by owner

      where("status", "==", "donated"),
      // filter donated items only
    );

    const requestsPendingQ = query(
    // Query: requests received by the user that are still pending

      collection(db, "requests"),
      // requests collection

      where("itemOwnerId", "==", firebaseUser.uid),
      // requests where current user is the item owner

      where("status", "==", "pending"),
      // only pending requests
    );

    const unsubListed = onSnapshot(itemsListedQ, (snap) =>
    // Real-time listener for listed items count

      setStats((prev) => ({ ...prev, listed: snap.size })),
      // Update only listed count with the number of docs in snapshot
    );

    const unsubDonated = onSnapshot(itemsDonatedQ, (snap) =>
    // Real-time listener for donated items count

      setStats((prev) => ({ ...prev, donated: snap.size })),
      // Update only donated count
    );

    const unsubRequests = onSnapshot(requestsPendingQ, (snap) =>
    // Real-time listener for pending requests received

      setStats((prev) => ({ ...prev, requests: snap.size })),
      // Update only requests count
    );

    return () => {
    // Cleanup: unsubscribe all listeners

      unsubListed();
      // Stop listening to listed items

      unsubDonated();
      // Stop listening to donated items

      unsubRequests();
      // Stop listening to pending requests
    };
  }, [firebaseUser?.uid]);
  // Dependency: rerun stats listeners when user ID changes

  const onLogoutPress = () => {
  // Function triggered when user presses Logout

    Alert.alert("Logout", "Are you sure you want to logout?", [
    // Show confirmation dialog

      { text: "Cancel", style: "cancel" },
      // Cancel button does nothing

      {
        text: "Logout",
        style: "destructive",
        // destructive style to show it’s a critical action

        onPress: async () => {
        // If user confirms logout, run async code

          try {
            await signOut(auth);
            // Firebase sign-out (clears auth session)

            router.replace("/(onboarding)");
            // Navigate back to onboarding screens (sign-in)
          } catch (e: any) {
            console.log("SignOut error:", e?.code, e?.message, e);
            // Log error for debugging

            Alert.alert(
              "Logout error",
              `${e?.code ?? ""}\n${e?.message ?? "Unknown error"}`,
            );
            // Show error message to user
          }
        },
      },
    ]);
  };

  // ✅ Reliable URI -> Blob (Expo iOS/Android)
  const uriToBlob = (uri: string) =>
  // Helper function: converts local file URI to Blob so Storage can upload it

    new Promise<Blob>((resolve, reject) => {
    // Return a Promise that resolves to a Blob

      const xhr = new XMLHttpRequest();
      // Use XHR to fetch the file data from the URI

      xhr.onload = () => resolve(xhr.response);
      // When loaded successfully, resolve with the binary response (Blob)

      xhr.onerror = () => reject(new Error("Failed to convert URI to Blob"));
      // On error, reject the promise

      xhr.responseType = "blob";
      // Set response type so we receive a Blob

      xhr.open("GET", uri, true);
      // Open HTTP GET request to read the local file

      xhr.send(null);
      // Send request
    });

  const changeAvatar = async () => {
  // Function to pick an image and upload it as the profile avatar

    if (!firebaseUser) {
    // If not signed in, block this action

      Alert.alert("Not signed in", "Please sign in again.");
      // Show message

      return;
      // Stop execution
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Ask user permission to access photo library

    if (status !== "granted") {
    // If permission denied, show an alert

      Alert.alert("Permission needed", "Please allow photo access.");
      // Explain what is needed

      return;
      // Stop execution
    }

    const result = await ImagePicker.launchImageLibraryAsync({
    // Open gallery to pick an image

      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // Only allow images

      quality: 0.8,
      // Compress image quality a bit to reduce size

      allowsEditing: true,
      // Allow user to crop/edit image in picker UI

      aspect: [1, 1],
      // Enforce square crop (1:1)
    });

    if (result.canceled) return;
    // If user cancels selecting, do nothing

    try {
      const uri = result.assets[0]?.uri;
      // Get local URI of selected image

      if (!uri) return;
      // If somehow missing, stop

      // 1) Upload to Storage
      const blob = await uriToBlob(uri);
      // Convert local URI to Blob

      const fileRef = ref(storage, `avatars/${firebaseUser.uid}.jpg`);
      // Create a storage path; fixed name so new upload replaces old one

      await uploadBytes(fileRef, blob);
      // Upload blob to Firebase Storage

      // @ts-ignore
      blob.close?.();
      // Release blob resources if environment supports it

      // 2) Get URL
      const url = await getDownloadURL(fileRef);
      // Get public downloadable URL for the uploaded avatar

      // 3) Save to Firestore user doc
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        avatarUrl: url,
      });
      // Update Firestore user doc with avatarUrl field

      // UI will update automatically via onSnapshot
      Alert.alert("Updated", "Profile photo updated!");
      // Notify user success
    } catch (e: any) {
      console.log("Avatar upload error:", e);
      // Log the error for debugging

      Alert.alert("Error", e?.message ?? "Failed to upload avatar.");
      // Show error in UI
    }
  };

  return (
    <View style={styles.screen}>
      {/* Main container */}

      <View style={styles.header}>
        {/* Header bar */}

        <Pressable
          onPress={() => router.back()}
          // Go back to previous screen

          hitSlop={12}
          // Increase tap area

          style={styles.backBtn}
          // Apply styling
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          {/* Back icon */}
        </Pressable>

        <Text style={styles.headerTitle}>Profile</Text>
        {/* Title in header */}

        <View style={{ width: 34 }} />
        {/* Spacer for centering title */}
      </View>

      {/* Avatar + Name */}
      <View style={styles.profileTop}>
        {/* Top section with avatar and user info */}

        <Pressable onPress={changeAvatar} style={styles.avatar}>
          {/* Avatar is clickable to change image */}

          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            // If avatarUrl exists: show the avatar image
          ) : (
            <Ionicons name="person" size={34} color={stylesVars.bg} />
            // Otherwise show default person icon
          )}

          {/* small edit badge */}
          <View style={styles.editBadge}>
            {/* Badge overlay in bottom-right corner */}
            <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
            {/* Camera icon inside badge */}
          </View>
        </Pressable>

        <Text style={styles.name}>{name}</Text>
        {/* Display name from Firestore */}

        <Text style={styles.email}>{email}</Text>
        {/* Display email from Firebase Auth */}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {/* Row holding 3 stat cards */}

        <View style={styles.statCard}>
          {/* Card 1: listed items */}
          <Text style={styles.statNumber}>{stats.listed}</Text>
          {/* Number */}
          <Text style={styles.statLabel}>Items listed</Text>
          {/* Label */}
        </View>

        <View style={styles.statCard}>
          {/* Card 2: donated items */}
          <Text style={styles.statNumber}>{stats.donated}</Text>
          {/* Number */}
          <Text style={styles.statLabel}>Items donated</Text>
          {/* Label */}
        </View>

        <View style={styles.statCard}>
          {/* Card 3: pending requests received */}
          <Text style={styles.statNumber}>{stats.requests}</Text>
          {/* Number */}
          <Text style={styles.statLabel}>Requests received</Text>
          {/* Label */}
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {/* Menu container */}

        <MenuItem
          icon="cube-outline"
          label="My Items"
          onPress={() => router.push("/my-items")}
          // Navigate to My Items screen
        />

        <MenuItem
          icon="chatbubble-ellipses-outline"
          label="My Requests"
          onPress={() => router.push("/my-requests")}
          // Navigate to My Requests screen
        />

        <MenuItem
          icon="settings-outline"
          label="Settings"
          onPress={() => router.push("/settings")}
          // Navigate to Settings screen
        />

        <MenuItem
          icon="log-out-outline"
          label="Logout"
          danger
          onPress={onLogoutPress}
          // Show confirm alert then sign out
        />
      </View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  // Icon name must match Ionicons allowed glyphs

  label: string;
  // Text label shown to the user

  onPress: () => void;
  // Function to run when pressed

  danger?: boolean;
  // Optional flag to style "danger" menu item (Logout)
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      {/* Entire row clickable */}

      <View style={styles.menuLeft}>
        {/* Left side contains icon and label */}

        <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
          {/* Icon container; if danger is true, apply danger style */}
          <Ionicons name={icon} size={18} color="#FFFFFF" />
          {/* Actual icon */}
        </View>

        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
          {/* Label text; apply danger style if needed */}
          {label}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={danger ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.75)"}
        // Right arrow icon; slightly different color if danger
      />
    </Pressable>
  );
}

const stylesVars = {
  bg: "#4F98DC",
  // Primary background

  text: "#FFFFFF",
  // Main text

  textSoft: "rgba(255,255,255,0.78)",
  // Softer text

  card: "rgba(255,255,255,0.16)",
  // Card background

  cardBorder: "rgba(255,255,255,0.22)",
  // Card border

  shadow: "rgba(0,0,0,0.18)",
  // Shadow color

  danger: "#E53935",
  // Red color for logout/danger
};

const styles = StyleSheet.create({
  // Styles for layout + UI components

  screen: {
    flex: 1,
    // Full screen

    backgroundColor: stylesVars.bg,
    // Blue background

    paddingTop: Platform.OS === "ios" ? 54 : 18,
    // Top padding depends on OS

    paddingHorizontal: 16,
    // Side padding
  },

  header: {
    height: 54,
    // Header height

    paddingHorizontal: 16,
    // Inner padding

    flexDirection: "row",
    // Row layout

    alignItems: "center",
    // Vertical center

    justifyContent: "space-between",
    // Spread back, title, spacer
  },

  headerTitle: {
    color: stylesVars.text,
    fontSize: 20,
    fontWeight: "800",
  },

  profileTop: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 18,
  },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 999,
    // Circle avatar

    backgroundColor: "#FFFFFF",
    // White background behind icon/image

    alignItems: "center",
    justifyContent: "center",
    // Center content inside avatar

    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    // iOS shadow

    elevation: 6,
    // Android shadow

    marginBottom: 12,
    // Space below avatar

    overflow: "hidden",
    // Ensures the image stays inside circle
  },

  avatarImg: {
    width: "100%",
    height: "100%",
  },

  editBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    // Position badge on bottom-right

    width: 26,
    height: 26,
    borderRadius: 999,
    // Circle badge

    backgroundColor: "rgba(0,0,0,0.35)",
    // Semi-transparent dark background

    alignItems: "center",
    justifyContent: "center",
  },

  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  name: {
    color: stylesVars.text,
    fontSize: 18,
    fontWeight: "800",
  },

  email: {
    color: stylesVars.textSoft,
    fontSize: 13,
    marginTop: 4,
    fontWeight: "600",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  statCard: {
    width: "32%",
    // Each card takes about 1/3 of row

    backgroundColor: stylesVars.card,

    borderWidth: 1,
    borderColor: stylesVars.cardBorder,

    borderRadius: 16,

    paddingVertical: 14,

    alignItems: "center",
    justifyContent: "center",

    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  statNumber: {
    color: stylesVars.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },

  statLabel: {
    color: stylesVars.textSoft,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  menu: {
    backgroundColor: "rgba(255,255,255,0.12)",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",

    borderRadius: 18,

    paddingVertical: 6,
  },

  menuItem: {
    height: 54,

    paddingHorizontal: 12,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  menuIcon: {
    width: 32,
    height: 32,

    borderRadius: 10,

    backgroundColor: "rgba(255,255,255,0.22)",

    alignItems: "center",
    justifyContent: "center",
  },

  menuIconDanger: {
    backgroundColor: "rgba(229,57,53,0.9)",
  },

  menuLabel: {
    color: stylesVars.text,
    fontSize: 14,
    fontWeight: "800",
  },

  menuLabelDanger: {
    color: "#FFFFFF",
  },
});
