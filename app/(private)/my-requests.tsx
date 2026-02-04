import React, { useEffect, useMemo, useState } from "react";
// React + hooks:
// useState = store state
// useEffect = run side-effects (Firestore listeners)
// useMemo = memoize computed values (avoid recalculations)

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  FlatList,
  Alert,
  Image,
} from "react-native";
// React Native UI primitives:
// View/Text = layout + text
// StyleSheet = define styles
// Pressable = clickable element
// Platform = detect iOS/Android
// FlatList = efficient list rendering
// Alert = popup messages
// Image = display avatar images

import { Ionicons } from "@expo/vector-icons";
// Icon library used for UI icons

import { useRouter } from "expo-router";
// Navigation hook to move between screens

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
// Firestore functions:
// collection/doc = references
// query/where/orderBy = build query
// onSnapshot = realtime listener
// getDoc = fetch a single doc once
// runTransaction = safe multi-doc updates
// serverTimestamp = server-generated timestamp

import { auth, db } from "@/lib/firebase";
// Firebase instances:
// auth = authentication (current user)
// db = Firestore database

type RequestDoc = {
  // TypeScript type for a request document (requests collection)

  id: string;
  // Firestore document id (we add it manually when mapping snapshot docs)

  itemId: string;
  // The item being requested (items/{itemId})

  itemOwnerId: string;
  // UID of the item owner (receiver of request)

  requesterId: string;
  // UID of the requester (sender of request)

  status: "pending" | "approved" | "rejected" | string;
  // Request status

  createdAt?: any;
  // Timestamp (serverTimestamp) when request created
};

type TabKey = "sent" | "received";
// Two tabs: requests I sent vs requests I received

type UserProfileCache = {
  // Cached user info for display
  name: string;
  // user display name from users collection

  avatarUrl: string;
  // profile photo URL stored in users doc
};

export default function MyRequestsScreen() {
  // Main screen component for My Requests

  const router = useRouter();
  // Router for navigation

  const user = auth.currentUser;
  // Current logged-in user (null if logged out)

  const [tab, setTab] = useState<TabKey>("sent");
  // Which tab is selected ("sent" by default)

  const [loading, setLoading] = useState(true);
  // Loading state while fetching data

  const [sent, setSent] = useState<RequestDoc[]>([]);
  // List of requests created by me (requesterId == my uid)

  const [received, setReceived] = useState<RequestDoc[]>([]);
  // List of requests sent to me (itemOwnerId == my uid)

  // Cache item titles: itemId -> title
  const [itemTitles, setItemTitles] = useState<Record<string, string>>({});
  // This avoids refetching items title every render

  // Cache user profiles: uid -> {name, avatarUrl}
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfileCache>>({});
  // This avoids refetching user name/avatar repeatedly

  const list = useMemo(() => (tab === "sent" ? sent : received), [tab, sent, received]);
  // Decide which list to show depending on active tab
  // useMemo prevents recalculating unless tab/sent/received changes

  // ---- Helpers ----
  const ensureItemTitle = async (itemId: string) => {
    // Ensures we have a cached title for an itemId

    if (!itemId) return;
    // If itemId is empty, do nothing

    if (itemTitles[itemId]) return;
    // If already cached, do nothing

    try {
      const snap = await getDoc(doc(db, "items", itemId));
      // Read items/{itemId} once

      const title = snap.exists() ? (snap.data() as any)?.title : null;
      // If document exists, extract title, else null

      setItemTitles((prev) => ({ ...prev, [itemId]: title ?? "Unknown item" }));
      // Save title in state (or fallback)
    } catch (e) {
      console.log("ensureItemTitle error:", e);
      // Log errors (network, permissions, etc.)
    }
  };

  const ensureUserProfile = async (uid: string) => {
    // Ensures we have cached {name, avatarUrl} for a user UID

    if (!uid) return;
    // If uid is empty, do nothing

    if (userProfiles[uid]) return;
    // If already cached, do nothing

    try {
      const snap = await getDoc(doc(db, "users", uid));
      // Read users/{uid} once

      if (!snap.exists()) {
        // If user doc not found, store fallback values

        setUserProfiles((prev) => ({
          ...prev,
          [uid]: { name: "Unknown user", avatarUrl: "" },
        }));
        // Save fallback profile

        return;
        // Exit early
      }

      const data = snap.data() as any;
      // Get user document fields

      setUserProfiles((prev) => ({
        ...prev,
        [uid]: {
          name: data?.name ?? "User",
          // Use stored name or fallback

          avatarUrl: data?.avatarUrl ?? "",
          // Use stored avatar URL or empty string
        },
      }));
      // Save profile in cache
    } catch (e) {
      console.log("ensureUserProfile error:", e);
      // Log any errors
    }
  };

  const hydrateDisplayData = async (reqs: RequestDoc[]) => {
    // When we receive a list of requests, fetch missing item titles + user profiles

    const uniqueItemIds = Array.from(new Set(reqs.map((r) => r.itemId).filter(Boolean)));
    // Extract itemIds from reqs, remove empty, make them unique

    const uniqueUserIds = Array.from(
      new Set(reqs.flatMap((r) => [r.requesterId, r.itemOwnerId]).filter(Boolean)),
    );
    // Extract requesterId + itemOwnerId for each req, remove empty, make unique

    await Promise.all([
      // Run all fetches in parallel

      ...uniqueItemIds.map((id) => ensureItemTitle(id)),
      // Ensure each item title is cached

      ...uniqueUserIds.map((id) => ensureUserProfile(id)),
      // Ensure each user profile is cached
    ]);
  };

  // ---- Live listeners (sent/received) ----
  useEffect(() => {
    // Setup Firestore realtime listeners for both "sent" and "received" queries

    if (!user) {
      // If no user logged in, clear state

      setLoading(false);
      // Stop loading

      setSent([]);
      // Clear sent list

      setReceived([]);
      // Clear received list

      return;
      // Exit effect early
    }

    setLoading(true);
    // Start loading while initial snapshots arrive

    const sentQ = query(
      collection(db, "requests"),
      // requests collection

      where("requesterId", "==", user.uid),
      // Sent requests are those where I am requester

      orderBy("createdAt", "desc"),
      // Newest first
    );

    const receivedQ = query(
      collection(db, "requests"),
      // requests collection

      where("itemOwnerId", "==", user.uid),
      // Received requests are those where I am item owner

      orderBy("createdAt", "desc"),
      // Newest first
    );

    const unsubSent = onSnapshot(
      sentQ,
      // Listen to sent query

      async (snap) => {
        // Called whenever sent requests change

        const data: RequestDoc[] = snap.docs.map((d) => ({
          id: d.id,
          // Save doc id

          ...(d.data() as any),
          // Spread request document fields
        }));

        setSent(data);
        // Update state

        setLoading(false);
        // Stop loading once data comes

        await hydrateDisplayData(data);
        // Fetch missing titles/users for UI display
      },

      (err) => {
        // Error callback

        console.log("Sent requests query error:", err);
        // Log

        setLoading(false);
        // Stop loading even if error
      },
    );

    const unsubReceived = onSnapshot(
      receivedQ,
      // Listen to received query

      async (snap) => {
        // Called whenever received requests change

        const data: RequestDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        // Convert docs to RequestDoc objects

        setReceived(data);
        // Update state

        setLoading(false);
        // Stop loading

        await hydrateDisplayData(data);
        // Fetch missing titles/users
      },

      (err) => {
        // Error callback

        console.log("Received requests query error:", err);
        // Log

        setLoading(false);
        // Stop loading
      },
    );

    return () => {
      // Cleanup both listeners when unmounting or user changes

      unsubSent();
      // Unsubscribe sent listener

      unsubReceived();
      // Unsubscribe received listener
    };
  }, [user?.uid]);
  // Re-run if user UID changes

  // ---- Approve / Reject with notifications + item status update ----
  const approve = async (requestId: string, itemId: string) => {
    // Approves a pending request (only the item owner should be able to do it)

    const currentUser = auth.currentUser;
    // Grab current user at the moment of clicking (safer than using old variable)

    if (!currentUser) {
      // If no user, cannot approve

      Alert.alert("Error", "Not signed in");
      // Show message

      return;
      // Stop function
    }

    try {
      const requestRef = doc(db, "requests", requestId);
      // Reference to requests/{requestId}

      const itemRef = doc(db, "items", itemId);
      // Reference to items/{itemId}

      await runTransaction(db, async (tx) => {
        // Firestore transaction ensures data stays consistent

        const reqSnap = await tx.get(requestRef);
        // Read request inside transaction

        const itemSnap = await tx.get(itemRef);
        // Read item inside transaction

        if (!reqSnap.exists()) throw new Error("Request not found");
        // Fail if request deleted

        if (!itemSnap.exists()) throw new Error("Item not found");
        // Fail if item deleted

        const req = reqSnap.data() as any;
        // Request data

        const item = itemSnap.data() as any;
        // Item data

        if (item.ownerId !== currentUser.uid) {
          // Security check: only owner can approve

          throw new Error("You are not the owner of this item.");
          // Abort transaction with error
        }

        tx.update(requestRef, { status: "approved" });
        // Update request -> approved

        tx.update(itemRef, { status: "accepted" });
        // Update item status -> accepted

        const notifRef = doc(collection(db, "notifications"));
        // Create a new notifications document with auto id

        tx.set(notifRef, {
          toUserId: req.requesterId,
          // Notification goes to requester

          title: "Request approved",
          // Notification title

          body: `Your request for "${item.title ?? "an item"}" was approved.`,
          // Message text (uses item title if available)

          type: "request_approved",
          // Notification type (your app can use this later)

          itemId: req.itemId,
          // Link notification to item

          read: false,
          // New notifications are unread

          createdAt: serverTimestamp(),
          // Server time (consistent across devices)

          fromUserId: currentUser.uid,
          // Who sent the notification (owner)
        });
        // Save notification inside the same transaction
      });

      Alert.alert("Approved", "Request approved and item marked as accepted.");
      // Success message
    } catch (e: any) {
      console.log("Approve error:", e);
      // Log error

      Alert.alert("Error", e?.message ?? "Failed to approve.");
      // Show error popup
    }
  };

  const reject = async (requestId: string, itemId: string) => {
    // Reject a pending request (only item owner can do it)

    const currentUser = auth.currentUser;
    // Current user

    if (!currentUser) {
      // If not logged in

      Alert.alert("Error", "Not signed in");
      // Popup

      return;
      // Stop
    }

    try {
      const requestRef = doc(db, "requests", requestId);
      // requests/{requestId}

      const itemRef = doc(db, "items", itemId);
      // items/{itemId}

      await runTransaction(db, async (tx) => {
        // Transaction for consistency

        const reqSnap = await tx.get(requestRef);
        // Read request

        const itemSnap = await tx.get(itemRef);
        // Read item

        if (!reqSnap.exists()) throw new Error("Request not found");
        // Request must exist

        if (!itemSnap.exists()) throw new Error("Item not found");
        // Item must exist

        const req = reqSnap.data() as any;
        // Request fields

        const item = itemSnap.data() as any;
        // Item fields

        if (item.ownerId !== currentUser.uid) {
          // Only owner can reject

          throw new Error("You are not the owner of this item.");
          // Abort
        }

        tx.update(requestRef, { status: "rejected" });
        // Update request -> rejected

        tx.update(itemRef, { status: "available" });
        // Make item available again

        const notifRef = doc(collection(db, "notifications"));
        // New notification doc

        tx.set(notifRef, {
          toUserId: req.requesterId,
          // Notify requester

          title: "Request rejected",
          // Title

          body: `Your request for "${item.title ?? "an item"}" was rejected.`,
          // Message

          type: "request_rejected",
          // Type label

          itemId: req.itemId,
          // Associated item id

          read: false,
          // Unread by default

          createdAt: serverTimestamp(),
          // Timestamp

          fromUserId: currentUser.uid,
          // Sender is item owner
        });
        // Save notification
      });

      Alert.alert("Rejected", "Request rejected and item marked as available.");
      // Success message
    } catch (e: any) {
      console.log("Reject error:", e);
      // Log error

      Alert.alert("Error", e?.message ?? "Failed to reject.");
      // Popup
    }
  };

  return (
    <View style={styles.screen}>
      {/* Screen root container */}

      {/* Header */}
      <View style={styles.header}>
        {/* Header row */}

        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          {/* Go back */}

          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          {/* Icon */}
        </Pressable>

        <Text style={styles.headerTitle}>My Requests</Text>
        {/* Title */}

        <View style={{ width: 34 }} />
        {/* Spacer so title stays centered */}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {/* Tab buttons wrapper */}

        <Pressable
          onPress={() => setTab("sent")}
          // Switch tab to "sent"

          style={[styles.tabBtn, tab === "sent" && styles.tabBtnActive]}
          // Apply active style if selected
        >
          <Text style={[styles.tabText, tab === "sent" && styles.tabTextActive]}>
            Sent
          </Text>
          {/* Tab label */}
        </Pressable>

        <Pressable
          onPress={() => setTab("received")}
          // Switch tab to "received"

          style={[styles.tabBtn, tab === "received" && styles.tabBtnActive]}
          // Apply active style if selected
        >
          <Text style={[styles.tabText, tab === "received" && styles.tabTextActive]}>
            Received
          </Text>
          {/* Tab label */}
        </Pressable>
      </View>

      {loading ? (
        // If loading, show loading message

        <Text style={styles.infoText}>Loading...</Text>
      ) : list.length === 0 ? (
        // If no requests in current tab, show empty state

        <Text style={styles.infoText}>
          {tab === "sent" ? "No sent requests yet." : "No received requests yet."}
        </Text>
      ) : (
        // Otherwise render list

        <FlatList
          data={list}
          // Data is either sent or received depending on tab

          keyExtractor={(r) => r.id}
          // Unique id for list item

          contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 16 }}
          // Padding for list

          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          // Space between cards

          renderItem={({ item }) => {
            // Render each request card

            const itemTitle = itemTitles[item.itemId] ?? "Loading...";
            // Show cached title or loading placeholder

            const requesterProfile = userProfiles[item.requesterId];
            // Cached profile for requester

            const ownerProfile = userProfiles[item.itemOwnerId];
            // Cached profile for item owner

            // Sent tab shows "To: owner"
            const displayName =
              tab === "sent"
                ? ownerProfile?.name ?? "Loading..."
                : requesterProfile?.name ?? "Loading...";
            // If I sent it, show owner name; if I received it, show requester name

            const displayAvatar =
              tab === "sent"
                ? ownerProfile?.avatarUrl ?? ""
                : requesterProfile?.avatarUrl ?? "";
            // Same logic for avatar

            return (
              <Pressable
                style={styles.card}
                // Card styling

                onPress={() =>
                  router.push({ pathname: "/item/[id]", params: { id: item.itemId } })
                }
                // Clicking card opens the item details
              >
                <View style={{ flex: 1 }}>
                  {/* Left side content */}

                  <Text style={styles.title}>Item: {itemTitle}</Text>
                  {/* Item title */}

                  <Text style={styles.sub}>Status: {item.status}</Text>
                  {/* Request status */}

                  <View style={styles.personRow}>
                    {/* Row for avatar + name */}

                    <View style={styles.avatarSmall}>
                      {/* Small avatar circle */}

                      {displayAvatar ? (
                        // If avatarUrl exists, show image

                        <Image source={{ uri: displayAvatar }} style={styles.avatarImg} />
                      ) : (
                        // Otherwise show default person icon

                        <Ionicons name="person" size={14} color="#4F98DC" />
                      )}
                    </View>

                    <Text style={styles.sub}>
                      {/* "To" or "From" label */}
                      {tab === "sent" ? "To: " : "From: "}
                      {displayName}
                    </Text>
                  </View>
                </View>

                {tab === "received" && item.status === "pending" ? (
                  // Only show action buttons when:
                  // 1) I'm on "received" tab (I'm the owner)
                  // 2) status is pending

                  <View style={styles.actions}>
                    {/* Actions column */}

                    <Pressable
                      onPress={() => approve(item.id, item.itemId)}
                      // Approve request

                      style={styles.actionBtn}
                      // Button style
                    >
                      <Text style={styles.actionText}>Accept</Text>
                      {/* Button label */}
                    </Pressable>

                    <Pressable
                      onPress={() => reject(item.id, item.itemId)}
                      // Reject request

                      style={[styles.actionBtn, styles.rejectBtn]}
                      // Reject button special style
                    >
                      <Text style={styles.actionText}>Reject</Text>
                      {/* Button label */}
                    </Pressable>
                  </View>
                ) : (
                  // Otherwise show chevron icon (no actions)

                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles for the screen

  screen: {
    flex: 1,
    // Full height

    backgroundColor: "#4F98DC",
    // Blue background

    paddingTop: Platform.OS === "ios" ? 54 : 18,
    // Top padding
  },

  header: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },

  tabBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  tabBtnActive: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  tabText: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "900",
  },

  tabTextActive: {
    color: "#FFFFFF",
  },

  infoText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 18,
  },

  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  title: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 4,
  },

  sub: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },

  avatarSmall: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImg: {
    width: "100%",
    height: "100%",
  },

  actions: {
    gap: 8,
  },

  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  rejectBtn: {
    backgroundColor: "rgba(229,57,53,0.9)",
    borderWidth: 0,
  },

  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
});
