import React, { useEffect, useMemo, useState } from "react"; 
// React core + hooks:
// useState = store state
// useEffect = run side effects (Firestore listener)
// useMemo = memoize computed values (not strictly needed here, but imported)

import { View, Text, StyleSheet, Pressable, FlatList, Platform, Image } from "react-native";
// React Native UI components:
// View/Text = layout + text
// StyleSheet = styles object
// Pressable = clickable UI
// FlatList = performant list
// Platform = detect iOS/Android for padding
// Image = show avatar

import { Ionicons } from "@expo/vector-icons";
// Icons used in UI

import { useRouter } from "expo-router";
// Navigation hook to move between screens

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
// Firestore methods:
// collection/doc = references
// query/where/orderBy = build a query
// onSnapshot = realtime listener
// updateDoc = update a document fields
// getDoc = read a document once

import { auth, db } from "@/lib/firebase";
// Your Firebase instances:
// auth = Firebase Auth (current user)
// db = Firestore instance

type Notif = {
  // TypeScript type representing a notification document

  id: string;
  // Firestore doc ID (we add it when mapping snapshot)

  toUserId: string;
  // who should receive this notification

  fromUserId?: string; // ✅ sender (optional for old notifications)
  // who triggered the notification (optional because older docs might not have it)

  title: string;
  // short title displayed in UI

  body: string;
  // message content displayed in UI

  type: string;
  // type label (e.g., request_received / request_approved)

  itemId: string;
  // related item id (used for navigation)

  read: boolean;
  // if the notification was opened/seen

  createdAt?: any;
  // Firestore timestamp
};

type UserProfile = {
  // Type for a user profile cached from users collection

  name: string;
  // user's display name

  avatarUrl: string;
  // user's avatar image URL from storage
};

export default function NotificationsScreen() {
  // Main notifications screen component

  const router = useRouter();
  // Router used to navigate to other screens

  const [loading, setLoading] = useState(true);
  // loading state while we fetch notifications

  const [notifs, setNotifs] = useState<Notif[]>([]);
  // list of notifications for current user

  // Cache sender profiles: uid -> {name, avatarUrl}
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  // dictionary/object cache: profiles["uid"] = { name, avatarUrl }

  useEffect(() => {
    // Runs once on mount (because dependency array is [])

    const user = auth.currentUser;
    // Grab the current logged-in user

    if (!user) {
      // If user is not logged in, no notifications should load

      setLoading(false);
      // stop loading

      setNotifs([]);
      // clear notifications

      return;
      // exit the effect
    }

    const q = query(
      collection(db, "notifications"),
      // base collection: notifications

      where("toUserId", "==", user.uid),
      // only notifications addressed to this user

      orderBy("createdAt", "desc")
      // newest first
    );

    const unsub = onSnapshot(
      q,
      // realtime listener for the query

      async (snap) => {
        // runs every time notification documents change

        const data: Notif[] = snap.docs.map((d) => ({
          id: d.id,
          // include document id

          ...(d.data() as any),
          // include all stored fields from Firestore
        }));

        setNotifs(data);
        // update the list state

        setLoading(false);
        // stop loading (we have data now)

        // Fetch sender profiles for notifications that have fromUserId
        const senderIds = Array.from(
          // Convert Set -> Array

          new Set(
            // Set makes them unique

            data
              .map((n) => n.fromUserId)
              // extract fromUserId from each notification

              .filter((x): x is string => !!x)
              // keep only truthy values and tell TypeScript: it's string now
          )
        );

        await Promise.all(senderIds.map((uid) => ensureProfile(uid)));
        // For each unique sender id, ensure we have their profile cached
      },

      (err) => {
        // listener error callback

        console.log("Notifications query error:", err);
        // log the error

        setLoading(false);
        // stop loading so UI shows message instead of stuck loading
      }
    );

    return unsub;
    // Cleanup: unsubscribe from Firestore listener when screen unmounts

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Empty dependency array = run only once per mount
  // (You disabled exhaustive-deps because ensureProfile/profiles aren't in deps)

  const ensureProfile = async (uid: string) => {
    // Fetch a sender profile only if it is not already in cache

    if (!uid) return;
    // guard: invalid uid

    if (profiles[uid]) return;
    // guard: already cached, do nothing

    try {
      const snap = await getDoc(doc(db, "users", uid));
      // Read users/{uid} document once

      if (!snap.exists()) {
        // If no user doc exists, store fallback profile

        setProfiles((prev) => ({ ...prev, [uid]: { name: "User", avatarUrl: "" } }));
        // cache fallback so we don't keep refetching

        return;
        // stop here
      }

      const data = snap.data() as any;
      // extract Firestore document fields

      setProfiles((prev) => ({
        ...prev,
        // keep other cached profiles

        [uid]: {
          name: data?.name ?? "User",
          // name from doc, fallback "User"

          avatarUrl: data?.avatarUrl ?? "",
          // avatarUrl from doc, fallback empty
        },
      }));
      // update cache for this uid
    } catch (e) {
      console.log("ensureProfile error:", e);
      // log errors (permissions/network)
    }
  };

  const markRead = async (id: string) => {
    // Mark a notification as read in Firestore

    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      // Update notifications/{id}.read = true
    } catch (e) {
      console.log("markRead error:", e);
      // log failures (permissions/network)
    }
  };

  const renderRow = ({ item }: { item: Notif }) => {
    // Render function for each FlatList row
    // item is one notification

    const sender = item.fromUserId ? profiles[item.fromUserId] : undefined;
    // If notification has fromUserId, lookup the cached profile

    const senderName = sender?.name ?? "";
    // Use sender name or empty

    const avatarUrl = sender?.avatarUrl ?? "";
    // Use sender avatarUrl or empty

    // If no sender name, just show the notification title/body as-is
    const subtitle = senderName ? `${senderName} • ${item.body}` : item.body;
    // Build subtitle: "SenderName • body" if senderName exists else just body

    return (
      <Pressable
        style={[styles.card, !item.read && styles.unreadCard]}
        // Base card style + unread highlight if read==false

        onPress={async () => {
          // When user taps notification

          await markRead(item.id);
          // Mark read first

          router.push({ pathname: "/my-requests", params: { id: item.itemId } });
          // Navigate (currently to My Requests screen)
          // NOTE: You are passing params.id but "/my-requests" doesn't use it in the code you shared.
          // If you intended to open item details, you would go to "/item/[id]" with itemId instead.
        }}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {/* Wrapper box for avatar/icon */}

          {avatarUrl ? (
            // If sender has an avatar URL

            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            // Show avatar image
          ) : (
            // Else show default notification icon

            <View style={styles.iconCircle}>
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          {/* Content column */}

          <Text style={styles.title}>{item.title}</Text>
          {/* Notification title */}

          <Text style={styles.sub}>{subtitle}</Text>
          {/* Notification body/subtitle */}
        </View>

        {!item.read ? <View style={styles.dot} /> : null}
        {/* Unread red dot indicator */}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Screen container */}

      <View style={styles.header}>
        {/* Header section */}

        <Text style={styles.headerTitle}>Notifications</Text>
        {/* Title */}
      </View>

      {loading ? (
        // If loading true, show loading message

        <Text style={styles.infoText}>Loading...</Text>
      ) : notifs.length === 0 ? (
        // If loaded but empty list

        <Text style={styles.infoText}>No notifications yet.</Text>
      ) : (
        // Else render FlatList

        <FlatList
          data={notifs}
          // list data

          keyExtractor={(n) => n.id}
          // unique key per row

          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          // padding inside list

          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          // spacing between cards

          renderItem={renderRow}
          // row renderer function
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles for the screen

  screen: {
    flex: 1,
    // take full height

    backgroundColor: "#4F98DC",
    // blue background

    paddingTop: Platform.OS === "ios" ? 54 : 18,
    // extra top padding on iOS
  },

  header: {
    alignItems: "center",
    // center header items horizontally

    paddingVertical: 10,
    // vertical padding
  },

  headerTitle: {
    color: "#FFFFFF",
    // white text

    fontSize: 20,
    // size

    fontWeight: "800",
    // bold
  },

  infoText: {
    color: "rgba(255,255,255,0.9)",
    // white but slightly transparent

    fontWeight: "700",
    // bold-ish

    paddingHorizontal: 16,
    // left/right padding

    paddingTop: 18,
    // top padding
  },

  card: {
    borderRadius: 18,
    // rounded corners

    padding: 14,
    // inner padding

    backgroundColor: "rgba(255,255,255,0.16)",
    // semi-transparent card background

    borderWidth: 1,
    // border thickness

    borderColor: "rgba(255,255,255,0.22)",
    // border color

    flexDirection: "row",
    // row layout

    alignItems: "center",
    // vertically center items

    gap: 12,
    // spacing between children
  },

  unreadCard: {
    backgroundColor: "rgba(255,255,255,0.22)",
    // slightly brighter background to highlight unread
  },

  avatarWrap: {
    width: 36,
    // fixed width

    height: 36,
    // fixed height

    borderRadius: 12,
    // rounded corners

    overflow: "hidden",
    // clip image inside rounded corners

    alignItems: "center",
    // center child

    justifyContent: "center",
    // center child
  },

  avatarImg: {
    width: "100%",
    // fill container width

    height: "100%",
    // fill container height
  },

  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    color: "#FFFFFF",
    // title text color

    fontWeight: "900",
    // heavy bold

    fontSize: 14,
    // size

    marginBottom: 2,
    // spacing below title
  },

  sub: {
    color: "rgba(255,255,255,0.82)",
    // subtitle color

    fontWeight: "600",
    // semi bold

    fontSize: 12,
    // size

    lineHeight: 16,
    // line spacing
  },

  dot: {
    width: 10,
    // dot width

    height: 10,
    // dot height

    borderRadius: 999,
    // make it circular

    backgroundColor: "#E53935",
    // red color for unread
  },
});
