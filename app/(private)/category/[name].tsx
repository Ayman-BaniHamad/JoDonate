import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ItemDoc = {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  status?: string;
  ownerId: string;
};

export default function CategoryScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();

  const categoryName = useMemo(() => (name ? decodeURIComponent(name) : ""), [name]);

  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryName) return;

    const q = query(
      collection(db, "items"),
      where("category", "==", categoryName),
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
        console.log("Category query error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [categoryName]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>{categoryName || "Category"}</Text>

        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <Text style={styles.infoText}>Loading...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.infoText}>No items in this category yet.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
              style={styles.card}
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
                <Text style={styles.sub} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
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
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },
});
