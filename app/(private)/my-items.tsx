import React, { useEffect, useState } from "react";
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
  deleteDoc,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

type ItemDoc = {
  id: string;
  title: string;
  description: string;
  category: string;
  status?: string;
  imageUrl?: string;
  ownerId: string;
  createdAt?: any;
  contactNumber?: string;
};

export default function MyItemsScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemDoc[]>([]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setItems([]);
      return;
    }

    const q = query(
      collection(db, "items"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: ItemDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        console.log("MyItems query error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid]);

  const markDonated = async (itemId: string) => {
    try {
      await updateDoc(doc(db, "items", itemId), { status: "donated" });
      Alert.alert("Done", "Item marked as donated.");
    } catch (e) {
      console.log("markDonated error:", e);
      Alert.alert("Error", "Failed to update item.");
    }
  };

  const deleteItem = async (item: ItemDoc) => {
    Alert.alert("Delete item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "items", item.id));

            if (item.imageUrl) {
              const fileRef = ref(storage, item.imageUrl);
              await deleteObject(fileRef).catch(() => {});
            }

            Alert.alert("Deleted", "Item deleted successfully.");
          } catch (e) {
            console.log("deleteItem error:", e);
            Alert.alert("Error", "Failed to delete item.");
          }
        },
      },
    ]);
  };

  const isAccepted = (s?: string) => (s ?? "").toLowerCase() === "accepted";
  const statusLabel = (s?: string) => (s ? s.toString() : "available");

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>My Items</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <Text style={styles.infoText}>Loading...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.infoText}>You have no items yet.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Main row opens item details */}
              <Pressable
                style={styles.cardRow}
                onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
              >
                <View style={styles.thumb}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
                  ) : (
                    <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.9)" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {item.category} • {statusLabel(item.status)}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
              </Pressable>

              {/* Actions */}
              <View style={styles.actionsRow}>
                {/* ✅ Edit */}
                <Pressable
                  style={[styles.actionBtn, styles.actionNeutral]}
                  onPress={() => router.push({ pathname: "/edit-item/[id]", params: { id: item.id } })}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>

                {/* ✅ Mark Donated ONLY if accepted */}
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.actionPrimary,
                    !isAccepted(item.status) && { opacity: 0.45 },
                  ]}
                  onPress={() => markDonated(item.id)}
                  disabled={!isAccepted(item.status)}
                >
                  <Text style={styles.actionText}>
                    {isAccepted(item.status) ? "Mark Donated" : "Mark Donated"}
                  </Text>
                </Pressable>

                {/* Delete */}
                <Pressable
                  style={[styles.actionBtn, styles.actionDanger]}
                  onPress={() => deleteItem(item)}
                >
                  <Text style={styles.actionText}>Delete</Text>
                </Pressable>
              </View>

              {/* Helper hint */}
              {!isAccepted(item.status) ? (
                <Text style={styles.hintText}>Mark Donated is available only after Accepted.</Text>
              ) : null}
            </View>
          )}
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
