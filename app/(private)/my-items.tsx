import React, { useEffect, useState } from "react";
// React core + hooks:
// useState = component state
// useEffect = run side effects (like Firestore listeners)

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  FlatList,
  Image,
  Alert,
} from "react-native";
// React Native UI building blocks:
// View/Text = layout + text
// StyleSheet = styles object
// Pressable = clickable component
// Platform = check iOS vs Android
// FlatList = performant list rendering
// Image = show item image
// Alert = popup dialog messages

import { Ionicons } from "@expo/vector-icons";
// Icon library used for UI icons (back, chevron, image placeholder)

import { useRouter } from "expo-router";
// Navigation hook for pushing/backing routes

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
// Firestore functions:
// collection/doc = references
// query/where/orderBy = build queries
// onSnapshot = realtime listener
// updateDoc = update document fields
// deleteDoc = delete documents

import { deleteObject, ref } from "firebase/storage";
// Firebase Storage functions:
// ref = create storage reference
// deleteObject = delete file from storage

import { auth, db, storage } from "@/lib/firebase";
// Your initialized Firebase instances:
// auth = authentication
// db = Firestore
// storage = Storage

type ItemDoc = {
  id: string;
  // Firestore document id for the item

  title: string;
  // Item title

  description: string;
  // Item description

  category: string;
  // Category name (Books, Furniture, ...)

  status?: string;
  // Status of item (available, requested, accepted, donated, ...)

  imageUrl?: string;
  // URL for the item image stored in Firebase Storage (download URL)

  ownerId: string;
  // UID of the user who created/owns this item

  createdAt?: any;
  // Firestore timestamp when item was created (serverTimestamp)

  contactNumber?: string;
  // Contact number stored with the item
};

export default function MyItemsScreen() {
  // Main screen component for listing the current user's items

  const router = useRouter();
  // Router instance for navigation

  const user = auth.currentUser;
  // Current signed-in user (or null if signed out)

  const [loading, setLoading] = useState(true);
  // Loading state: shows "Loading..." while fetching Firestore items

  const [items, setItems] = useState<ItemDoc[]>([]);
  // Items state: array of item docs that belong to the logged-in user

  useEffect(() => {
    // This effect subscribes to the user's items in Firestore in real-time

    if (!user) {
      // If there is no signed-in user, stop and show empty list

      setLoading(false);
      // Not loading anymore

      setItems([]);
      // Clear list

      return;
      // Exit effect early
    }

    const q = query(
      // Build Firestore query

      collection(db, "items"),
      // Read from "items" collection

      where("ownerId", "==", user.uid),
      // Filter items where ownerId matches current user

      orderBy("createdAt", "desc"),
      // Sort newest items first
    );

    const unsub = onSnapshot(
      // Subscribe to realtime updates for this query

      q,
      // Query to listen to

      (snap) => {
        // Callback runs whenever Firestore returns data or changes happen

        const data: ItemDoc[] = snap.docs.map((d) => ({
          // Convert snapshot documents into plain objects

          id: d.id,
          // Add document id into the object

          ...(d.data() as any),
          // Add all Firestore fields into the object
        }));

        setItems(data);
        // Store results in state

        setLoading(false);
        // Stop showing loading UI
      },

      (err) => {
        // Error callback if query fails

        console.log("MyItems query error:", err);
        // Print error for debugging

        setLoading(false);
        // Stop loading even if error
      },
    );

    return unsub;
    // Cleanup: unsubscribe listener when screen unmounts or user changes
  }, [user?.uid]);
  // Re-run this effect if the user changes (uid changes)

  const markDonated = async (itemId: string) => {
    // Mark an item as donated by updating Firestore

    try {
      await updateDoc(doc(db, "items", itemId), { status: "donated" });
      // Update items/{itemId} -> status = "donated"

      Alert.alert("Done", "Item marked as donated.");
      // Notify the user
    } catch (e) {
      // Handle errors

      console.log("markDonated error:", e);
      // Log error

      Alert.alert("Error", "Failed to update item.");
      // Show error popup
    }
  };

  const deleteItem = async (item: ItemDoc) => {
    // Delete an item document (and attempt to delete its image)

    Alert.alert("Delete item", "Are you sure you want to delete this item?", [
      // Confirmation dialog so we don't delete accidentally

      { text: "Cancel", style: "cancel" },
      // Cancel button: does nothing

      {
        text: "Delete",
        style: "destructive",
        // Destructive style shows it is a dangerous action

        onPress: async () => {
          // If user confirms, do the deletion

          try {
            await deleteDoc(doc(db, "items", item.id));
            // Delete the Firestore doc: items/{item.id}

            if (item.imageUrl) {
              // If there is an image URL, try deleting it from Storage

              const fileRef = ref(storage, item.imageUrl);
              // Create storage reference from the URL/path provided

              await deleteObject(fileRef).catch(() => {});
              // Try deleting the file; ignore errors silently
              // (sometimes URL isn't a valid storage path, or file already deleted)
            }

            Alert.alert("Deleted", "Item deleted successfully.");
            // Success message
          } catch (e) {
            // Handle errors in deletion

            console.log("deleteItem error:", e);
            // Log details

            Alert.alert("Error", "Failed to delete item.");
            // Show error popup
          }
        },
      },
    ]);
  };

  const isAccepted = (s?: string) => (s ?? "").toLowerCase() === "accepted";
  // Helper function:
  // returns true only if status is exactly "accepted" (case-insensitive)

  const statusLabel = (s?: string) => (s ? s.toString() : "available");
  // Helper function:
  // converts status to string for UI display, defaults to "available"

  return (
    <View style={styles.screen}>
      {/* Root screen container */}

      {/* Header */}
      <View style={styles.header}>
        {/* Header row (Back button + title + spacer) */}

        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          {/* Back button press -> go back in navigation stack */}
          {/* hitSlop makes it easier to tap */}

          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          {/* Back icon */}
        </Pressable>

        <Text style={styles.headerTitle}>My Items</Text>
        {/* Header title */}

        <View style={{ width: 34 }} />
        {/* Spacer so title is centered */}
      </View>

      {loading ? (
        // If loading == true, show loading text

        <Text style={styles.infoText}>Loading...</Text>
      ) : items.length === 0 ? (
        // If not loading and list is empty, show empty message

        <Text style={styles.infoText}>You have no items yet.</Text>
      ) : (
        // Otherwise render the list of items

        <FlatList
          data={items}
          // Data source for the list

          keyExtractor={(item) => item.id}
          // Unique key per list row

          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          // Padding for list content

          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          // Adds spacing between cards

          renderItem={({ item }) => (
            // Render each row (item card)

            <View style={styles.card}>
              {/* Card container */}

              {/* Main row opens item details */}
              <Pressable
                style={styles.cardRow}
                // Styles for main clickable row

                onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
                // Navigate to item details screen when pressed
              >
                <View style={styles.thumb}>
                  {/* Image thumbnail container */}

                  {item.imageUrl ? (
                    // If item has an imageUrl show it

                    <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
                  ) : (
                    // Otherwise show a placeholder icon

                    <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.9)" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  {/* Text column expands to fill available space */}

                  <Text style={styles.title} numberOfLines={1}>
                    {/* Item title, limited to 1 line */}
                    {item.title}
                  </Text>

                  <Text style={styles.sub} numberOfLines={1}>
                    {/* Secondary text line: category + status */}
                    {item.category} • {statusLabel(item.status)}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
                {/* Right chevron icon */}
              </Pressable>

              {/* Actions */}
              <View style={styles.actionsRow}>
                {/* Row with action buttons */}

                {/* ✅ Edit */}
                <Pressable
                  style={[styles.actionBtn, styles.actionNeutral]}
                  // Neutral style for edit button

                  onPress={() =>
                    router.push({ pathname: "/edit-item/[id]", params: { id: item.id } })
                  }
                  // Navigate to Edit Item screen
                >
                  <Text style={styles.actionText}>Edit</Text>
                  {/* Button label */}
                </Pressable>

                {/* ✅ Mark Donated ONLY if accepted */}
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.actionPrimary,
                    // Primary style for donate button

                    !isAccepted(item.status) && { opacity: 0.45 },
                    // If not accepted, show it as disabled (faded)
                  ]}
                  onPress={() => markDonated(item.id)}
                  // Trigger Firestore update

                  disabled={!isAccepted(item.status)}
                  // Disable button unless status is accepted
                >
                  <Text style={styles.actionText}>
                    {/* Button text; stays same but only enabled when accepted */}
                    {isAccepted(item.status) ? "Mark Donated" : "Mark Donated"}
                  </Text>
                </Pressable>

                {/* Delete */}
                <Pressable
                  style={[styles.actionBtn, styles.actionDanger]}
                  // Danger style for delete

                  onPress={() => deleteItem(item)}
                  // Ask for confirmation then delete item
                >
                  <Text style={styles.actionText}>Delete</Text>
                  {/* Button label */}
                </Pressable>
              </View>

              {/* Helper hint */}
              {!isAccepted(item.status) ? (
                // If item is NOT accepted, show a hint under actions

                <Text style={styles.hintText}>
                  Mark Donated is available only after Accepted.
                </Text>
              ) : null}
              {/* If accepted, show nothing */}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles for My Items screen

  screen: {
    flex: 1,
    // Full height screen

    backgroundColor: "#4F98DC",
    // Screen background color

    paddingTop: Platform.OS === "ios" ? 54 : 18,
    // Top padding differs by OS
  },

  header: {
    height: 54,
    // Header height

    paddingHorizontal: 16,
    // Horizontal padding

    flexDirection: "row",
    // Arrange children horizontally

    alignItems: "center",
    // Center vertically

    justifyContent: "space-between",
    // Space between back/title/spacer
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

  infoText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 18,
  },

  card: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },

  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    // Keeps image inside rounded corners
  },

  thumbImg: {
    width: "100%",
    height: "100%",
  },

  title: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 4,
  },

  sub: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "700",
    fontSize: 12,
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  actionBtn: {
    flex: 1,
    // Each button takes equal width

    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  actionNeutral: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  actionPrimary: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  actionDanger: {
    backgroundColor: "rgba(229,57,53,0.9)",
  },

  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },

  hintText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
    fontSize: 11,
  },
});

// The fucntion of this file is to list the current user's items from Firestore,
// allowing them to edit, mark as donated, or delete each item.