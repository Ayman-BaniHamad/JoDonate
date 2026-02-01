import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { auth, db } from "@/lib/firebase";

type Notif = {
  id: string;
  toUserId: string;
  fromUserId?: string; // ✅ sender (optional for old notifications)
  title: string;
  body: string;
  type: string;
  itemId: string;
  read: boolean;
  createdAt?: any;
};

type UserProfile = {
  name: string;
  avatarUrl: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  // Cache sender profiles: uid -> {name, avatarUrl}
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setNotifs([]);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("toUserId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const data: Notif[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setNotifs(data);
        setLoading(false);

        // Fetch sender profiles for notifications that have fromUserId
        const senderIds = Array.from(
          new Set(
            data
              .map((n) => n.fromUserId)
              .filter((x): x is string => !!x)
          )
        );

        await Promise.all(senderIds.map((uid) => ensureProfile(uid)));
      },
      (err) => {
        console.log("Notifications query error:", err);
        setLoading(false);
      }
    );

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureProfile = async (uid: string) => {
    if (!uid) return;
    if (profiles[uid]) return;

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setProfiles((prev) => ({ ...prev, [uid]: { name: "User", avatarUrl: "" } }));
        return;
      }

      const data = snap.data() as any;
      setProfiles((prev) => ({
        ...prev,
        [uid]: {
          name: data?.name ?? "User",
          avatarUrl: data?.avatarUrl ?? "",
        },
      }));
    } catch (e) {
      console.log("ensureProfile error:", e);
    }
  };

  const markRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (e) {
      console.log("markRead error:", e);
    }
  };

  const renderRow = ({ item }: { item: Notif }) => {
    const sender = item.fromUserId ? profiles[item.fromUserId] : undefined;

    const senderName = sender?.name ?? "";
    const avatarUrl = sender?.avatarUrl ?? "";

    // If no sender name, just show the notification title/body as-is
    const subtitle = senderName ? `${senderName} • ${item.body}` : item.body;

    return (
      <Pressable
        style={[styles.card, !item.read && styles.unreadCard]}
        onPress={async () => {
          await markRead(item.id);
          router.push({ pathname: "/my-requests", params: { id: item.itemId } });
        }}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.iconCircle}>
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>

        {!item.read ? <View style={styles.dot} /> : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {loading ? (
        <Text style={styles.infoText}>Loading...</Text>
      ) : notifs.length === 0 ? (
        <Text style={styles.infoText}>No notifications yet.</Text>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={renderRow}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#4F98DC",
    paddingTop: Platform.OS === "ios" ? 54 : 18,
  },
  header: {
    alignItems: "center",
    paddingVertical: 10,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
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
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  unreadCard: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },

  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
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
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 2,
  },
  sub: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E53935",
  },
});
