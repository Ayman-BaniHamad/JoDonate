import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type ItemDoc = {
  title: string;
  description: string;
  category: string;
  status?: "available" | "requested" | "accepted" | "donated" | string;
  imageUrl?: string;
  contactNumber?: string;
  ownerId: string;
  createdAt?: any;
};

export default function ItemDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<ItemDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // ✅ LIVE updates for item changes (status, etc.)
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const itemRef = doc(db, "items", id);

    const unsub = onSnapshot(
      itemRef,
      (snap) => {
        if (!snap.exists()) {
          setItem(null);
        } else {
          setItem(snap.data() as ItemDoc);
        }
        setLoading(false);
      },
      (err) => {
        console.log("Item details snapshot error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [id]);

  const isAvailable = useMemo(() => {
    const s = (item?.status ?? "available").toString().toLowerCase();
    return s === "available";
  }, [item?.status]);

  const onRequestItem = async () => {
    if (!id) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Not signed in", "Please sign in to request an item.");
      router.replace("/(onboarding)");
      return;
    }

    if (!item) return;

    // Prevent requesting own item
    if (item.ownerId === user.uid) {
      Alert.alert("Not allowed", "You cannot request your own item.");
      return;
    }

    // Prevent requesting non-available item
    if (!isAvailable) {
      Alert.alert("Unavailable", "This item is not available to request.");
      return;
    }

    try {
      setRequesting(true);

      // Unique request id prevents duplicates per user per item
      const requestId = `${id}_${user.uid}`;
      const itemRef = doc(db, "items", id);
      const requestRef = doc(db, "requests", requestId);

      await runTransaction(db, async (tx) => {
        const itemSnap = await tx.get(itemRef);
        if (!itemSnap.exists()) {
          throw new Error("Item not found.");
        }

        const liveItem = itemSnap.data() as ItemDoc;
        const liveStatus = (liveItem.status ?? "available").toString().toLowerCase();

        if (liveItem.ownerId === user.uid) {
          throw new Error("You cannot request your own item.");
        }

        if (liveStatus !== "available") {
          throw new Error("This item is not available.");
        }

        const requestSnap = await tx.get(requestRef);
        if (requestSnap.exists()) {
          throw new Error("You already requested this item.");
        }
        // Create notification for item owner
    const notifRef = doc(collection(db, "notifications"));
    tx.set(notifRef, {
    toUserId: liveItem.ownerId,
    fromUserId: user.uid,
    title: "New request received",
    body: "Someone requested your item.",
    type: "request_received",
    itemId: id,
    read: false,
    createdAt: serverTimestamp(),
    });


        // Create request
        tx.set(requestRef, {
          itemId: id,
          itemOwnerId: liveItem.ownerId,
          requesterId: user.uid,
          status: "pending",
          createdAt: serverTimestamp(),
        });

        // Update item status immediately
        tx.update(itemRef, { status: "requested" });
      });

      Alert.alert("Request sent", "The item owner has been notified.");
    } catch (e: any) {
      console.log("Request error:", e);
      Alert.alert("Request failed", e?.message ?? "Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>Item Details</Text>

        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <Text style={styles.infoText}>Loading...</Text>
      ) : !item ? (
        <Text style={styles.infoText}>Item not found.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Image */}
          <View style={styles.imageBox}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
            ) : (
              <>
                <Ionicons name="image-outline" size={34} color="rgba(255,255,255,0.9)" />
                <Text style={styles.imageHint}>No image</Text>
              </>
            )}
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>

            <View style={styles.row}>
              <View style={styles.chip}>
                <Ionicons name="pricetag-outline" size={14} color="#FFFFFF" />
                <Text style={styles.chipText}>{item.category}</Text>
              </View>

              <View style={styles.chipSoft}>
                <Ionicons name="radio-button-on-outline" size={14} color="#FFFFFF" />
                <Text style={styles.chipText}>{(item.status ?? "available").toString()}</Text>
              </View>
            </View>

            {item.contactNumber ? (
              <View style={[styles.row, { marginTop: 12 }]}>
                <Ionicons name="call-outline" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.metaText}>{item.contactNumber}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.desc}>{item.description}</Text>

            <Pressable
              onPress={onRequestItem}
              disabled={requesting || !isAvailable}
              style={[
                styles.primaryBtn,
                (requesting || !isAvailable) && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {requesting ? "Requesting..." : isAvailable ? "Request Item" : "Not Available"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
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
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  infoText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  imageBox: {
    height: 220,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 14,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageHint: {
    marginTop: 8,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
  },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  chipSoft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  chipText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "capitalize",
  },
  metaText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 6,
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  desc: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 16,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#4F98DC",
    fontWeight: "900",
    fontSize: 16,
  },
});
