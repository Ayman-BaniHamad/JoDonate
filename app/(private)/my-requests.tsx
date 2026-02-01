import React, { useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import { auth, db } from "@/lib/firebase";

type RequestDoc = {
  id: string;
  itemId: string;
  itemOwnerId: string;
  requesterId: string;
  status: "pending" | "approved" | "rejected" | string;
  createdAt?: any;
};

type TabKey = "sent" | "received";

type UserProfileCache = {
  name: string;
  avatarUrl: string;
};

export default function MyRequestsScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [tab, setTab] = useState<TabKey>("sent");
  const [loading, setLoading] = useState(true);

  const [sent, setSent] = useState<RequestDoc[]>([]);
  const [received, setReceived] = useState<RequestDoc[]>([]);

  // Cache item titles: itemId -> title
  const [itemTitles, setItemTitles] = useState<Record<string, string>>({});

  // Cache user profiles: uid -> {name, avatarUrl}
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfileCache>>({});

  const list = useMemo(() => (tab === "sent" ? sent : received), [tab, sent, received]);

  // ---- Helpers ----
  const ensureItemTitle = async (itemId: string) => {
    if (!itemId) return;
    if (itemTitles[itemId]) return;

    try {
      const snap = await getDoc(doc(db, "items", itemId));
      const title = snap.exists() ? (snap.data() as any)?.title : null;
      setItemTitles((prev) => ({ ...prev, [itemId]: title ?? "Unknown item" }));
    } catch (e) {
      console.log("ensureItemTitle error:", e);
    }
  };

  const ensureUserProfile = async (uid: string) => {
    if (!uid) return;
    if (userProfiles[uid]) return;

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setUserProfiles((prev) => ({
          ...prev,
          [uid]: { name: "Unknown user", avatarUrl: "" },
        }));
        return;
      }

      const data = snap.data() as any;
      setUserProfiles((prev) => ({
        ...prev,
        [uid]: {
          name: data?.name ?? "User",
          avatarUrl: data?.avatarUrl ?? "",
        },
      }));
    } catch (e) {
      console.log("ensureUserProfile error:", e);
    }
  };

  const hydrateDisplayData = async (reqs: RequestDoc[]) => {
    const uniqueItemIds = Array.from(new Set(reqs.map((r) => r.itemId).filter(Boolean)));
    const uniqueUserIds = Array.from(
      new Set(reqs.flatMap((r) => [r.requesterId, r.itemOwnerId]).filter(Boolean))
    );

    await Promise.all([
      ...uniqueItemIds.map((id) => ensureItemTitle(id)),
      ...uniqueUserIds.map((id) => ensureUserProfile(id)),
    ]);
  };

  // ---- Live listeners (sent/received) ----
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setSent([]);
      setReceived([]);
      return;
    }

    setLoading(true);

    const sentQ = query(
      collection(db, "requests"),
      where("requesterId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const receivedQ = query(
      collection(db, "requests"),
      where("itemOwnerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubSent = onSnapshot(
      sentQ,
      async (snap) => {
        const data: RequestDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setSent(data);
        setLoading(false);
        await hydrateDisplayData(data);
      },
      (err) => {
        console.log("Sent requests query error:", err);
        setLoading(false);
      }
    );

    const unsubReceived = onSnapshot(
      receivedQ,
      async (snap) => {
        const data: RequestDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setReceived(data);
        setLoading(false);
        await hydrateDisplayData(data);
      },
      (err) => {
        console.log("Received requests query error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [user?.uid]);

  // ---- Approve / Reject with notifications + item status update ----
  const approve = async (requestId: string, itemId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "Not signed in");
      return;
    }

    try {
      const requestRef = doc(db, "requests", requestId);
      const itemRef = doc(db, "items", itemId);

      await runTransaction(db, async (tx) => {
        const reqSnap = await tx.get(requestRef);
        const itemSnap = await tx.get(itemRef);

        if (!reqSnap.exists()) throw new Error("Request not found");
        if (!itemSnap.exists()) throw new Error("Item not found");

        const req = reqSnap.data() as any;
        const item = itemSnap.data() as any;

        if (item.ownerId !== currentUser.uid) {
          throw new Error("You are not the owner of this item.");
        }

        tx.update(requestRef, { status: "approved" });
        tx.update(itemRef, { status: "accepted" });

        const notifRef = doc(collection(db, "notifications"));
        tx.set(notifRef, {
          toUserId: req.requesterId,
          title: "Request approved",
          body: `Your request for "${item.title ?? "an item"}" was approved.`,
          type: "request_approved",
          itemId: req.itemId,
          read: false,
          createdAt: serverTimestamp(),
          fromUserId: currentUser.uid,

        });
      });

      Alert.alert("Approved", "Request approved and item marked as accepted.");
    } catch (e: any) {
      console.log("Approve error:", e);
      Alert.alert("Error", e?.message ?? "Failed to approve.");
    }
  };

  const reject = async (requestId: string, itemId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "Not signed in");
      return;
    }

    try {
      const requestRef = doc(db, "requests", requestId);
      const itemRef = doc(db, "items", itemId);

      await runTransaction(db, async (tx) => {
        const reqSnap = await tx.get(requestRef);
        const itemSnap = await tx.get(itemRef);

        if (!reqSnap.exists()) throw new Error("Request not found");
        if (!itemSnap.exists()) throw new Error("Item not found");

        const req = reqSnap.data() as any;
        const item = itemSnap.data() as any;

        if (item.ownerId !== currentUser.uid) {
          throw new Error("You are not the owner of this item.");
        }

        tx.update(requestRef, { status: "rejected" });
        tx.update(itemRef, { status: "available" });

        const notifRef = doc(collection(db, "notifications"));
        tx.set(notifRef, {
          toUserId: req.requesterId,
          title: "Request rejected",
          body: `Your request for "${item.title ?? "an item"}" was rejected.`,
          type: "request_rejected",
          itemId: req.itemId,
          read: false,
          createdAt: serverTimestamp(),
          fromUserId: currentUser.uid,

        });
      });

      Alert.alert("Rejected", "Request rejected and item marked as available.");
    } catch (e: any) {
      console.log("Reject error:", e);
      Alert.alert("Error", e?.message ?? "Failed to reject.");
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>My Requests</Text>

        <View style={{ width: 34 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("sent")}
          style={[styles.tabBtn, tab === "sent" && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, tab === "sent" && styles.tabTextActive]}>Sent</Text>
        </Pressable>

        <Pressable
          onPress={() => setTab("received")}
          style={[styles.tabBtn, tab === "received" && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, tab === "received" && styles.tabTextActive]}>
            Received
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <Text style={styles.infoText}>Loading...</Text>
      ) : list.length === 0 ? (
        <Text style={styles.infoText}>
          {tab === "sent" ? "No sent requests yet." : "No received requests yet."}
        </Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const itemTitle = itemTitles[item.itemId] ?? "Loading...";
            const requesterProfile = userProfiles[item.requesterId];
            const ownerProfile = userProfiles[item.itemOwnerId];

            // Sent tab shows "To: owner"
            const displayName = tab === "sent"
              ? (ownerProfile?.name ?? "Loading...")
              : (requesterProfile?.name ?? "Loading...");

            const displayAvatar = tab === "sent"
              ? (ownerProfile?.avatarUrl ?? "")
              : (requesterProfile?.avatarUrl ?? "");

            return (
              <Pressable
                style={styles.card}
                onPress={() =>
                  router.push({ pathname: "/item/[id]", params: { id: item.itemId } })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Item: {itemTitle}</Text>
                  <Text style={styles.sub}>Status: {item.status}</Text>

                  <View style={styles.personRow}>
                    <View style={styles.avatarSmall}>
                      {displayAvatar ? (
                        <Image source={{ uri: displayAvatar }} style={styles.avatarImg} />
                      ) : (
                        <Ionicons name="person" size={14} color="#4F98DC" />
                      )}
                    </View>

                    <Text style={styles.sub}>
                      {tab === "sent" ? "To: " : "From: "}
                      {displayName}
                    </Text>
                  </View>
                </View>

                {tab === "received" && item.status === "pending" ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => approve(item.id, item.itemId)}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionText}>Accept</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => reject(item.id, item.itemId)}
                      style={[styles.actionBtn, styles.rejectBtn]}
                    >
                      <Text style={styles.actionText}>Reject</Text>
                    </Pressable>
                  </View>
                ) : (
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
  screen: {
    flex: 1,
    backgroundColor: "#4F98DC",
    paddingTop: Platform.OS === "ios" ? 54 : 18,
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
