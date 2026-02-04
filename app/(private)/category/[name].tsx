import React, { useEffect, useMemo, useState } from "react";
// React core
// useState = store UI state
// useEffect = subscribe/unsubscribe to Firestore updates
// useMemo = compute categoryName only when `name` changes

import { View, Text, StyleSheet, Pressable, FlatList, Platform, Image } from "react-native";
// View = container
// Text = display text
// StyleSheet = styles object
// Pressable = clickable/touchable elements
// FlatList = efficient list rendering
// Platform = detect iOS/Android for padding
// Image = show item thumbnail

import { Ionicons } from "@expo/vector-icons";
// Ionicons = icons library

import { useLocalSearchParams, useRouter } from "expo-router";
// useRouter = navigation (push/back)
// useLocalSearchParams = read URL params (name from /category/[name])

import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
// collection = reference to a Firestore collection
// query = build a query
// where = filter documents by field condition
// orderBy = sort results by a field
// onSnapshot = realtime listener (updates UI when data changes)

import { db } from "@/lib/firebase";
// db = Firestore instance (already initialized in lib/firebase.ts)

type ItemDoc = {
  id: string; // Firestore document id (added manually from snap doc.id)
  title: string; // item title
  description: string; // item description
  category: string; // item category name (matches Firestore "category")
  imageUrl?: string; // optional image URL stored in Firestore
  status?: string; // optional status (available/requested/accepted/donated)
  ownerId: string; // UID of the user who listed the item
};
// ItemDoc = shape of item data that our screen expects from Firestore

export default function CategoryScreen() {
  // Screen that lists all items that belong to a specific category

  const router = useRouter();
  // router controls navigation

  const { name } = useLocalSearchParams<{ name: string }>();
  // name comes from the URL: /category/[name]
  // Example: "Books" or "Electronics"

  const categoryName = useMemo(() => (name ? decodeURIComponent(name) : ""), [name]);
  // decodeURIComponent turns URL text into normal text (handles spaces/special chars)
  // useMemo avoids re-decoding on every render unless `name` changes

  const [items, setItems] = useState<ItemDoc[]>([]);
  // items list for the category

  const [loading, setLoading] = useState(true);
  // loading = show Loading... until Firestore returns data

  useEffect(() => {
    // Runs when categoryName changes (user opens a different category)

    if (!categoryName) return;
    // If categoryName is empty, don't query Firestore

    const q = query(
      collection(db, "items"),
      // reference to Firestore collection "items"

      where("category", "==", categoryName),
      // filter items where category matches selected category

      orderBy("createdAt", "desc")
      // sort by newest first (requires createdAt field to exist)
    );

    const unsub = onSnapshot(
      q,
      // start realtime listener on this query

      (snap) => {
        // callback when data changes or first time it loads
        const data: ItemDoc[] = snap.docs.map((d) => ({
          // convert each document into a JS object
          id: d.id,
          // attach Firestore doc id
          ...(d.data() as any),
          // spread the remaining fields from Firestore
        }));

        setItems(data);
        // update UI list

        setLoading(false);
        // stop loading
      },
      (err) => {
        // callback when listener fails
        console.log("Category query error:", err);
        // log the error for debugging
        setLoading(false);
        // stop loading to avoid infinite spinner
      }
    );

    return unsub;
    // cleanup: stop listening when screen unmounts or categoryName changes
  }, [categoryName]);
  // dependency array: re-run effect if categoryName changes

  return (
    <View style={styles.screen}>
      {/* Main screen container */}

      {/* Header */}
      <View style={styles.header}>
        {/* Header row with back button + title */}

        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          {/* Back button (hitSlop makes it easier to tap) */}
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          {/* Back icon */}
        </Pressable>

        <Text style={styles.headerTitle}>{categoryName || "Category"}</Text>
        {/* Show the category title; fallback to "Category" if missing */}

        <View style={{ width: 34 }} />
        {/* Right spacer so the title stays centered */}
      </View>

      {loading ? (
        // If still loading data
        <Text style={styles.infoText}>Loading...</Text>
      ) : items.length === 0 ? (
        // If loaded but no items in this category
        <Text style={styles.infoText}>No items in this category yet.</Text>
      ) : (
        // Otherwise show list of items
        <FlatList
          data={items}
          // items to render

          keyExtractor={(item) => item.id}
          // unique key for each row (Firestore document id)

          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          // list padding

          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          // spacing between cards

          renderItem={({ item }) => (
            // how to render each item card
            <Pressable
              onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
              // pressing card navigates to Item Details screen

              style={styles.card}
              // card styling
            >
              <View style={styles.thumb}>
                {/* Thumbnail container */}
                {item.imageUrl ? (
                  // if image exists
                  <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
                ) : (
                  // if no image
                  <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.9)" />
                )}
              </View>

              <View style={{ flex: 1 }}>
                {/* Text section expands to fill space */}
                <Text style={styles.title} numberOfLines={1}>
                  {/* Title only one line */}
                  {item.title}
                </Text>

                <Text style={styles.sub} numberOfLines={2}>
                  {/* Description up to two lines */}
                  {item.description}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
              {/* Right arrow icon */}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // StyleSheet for the whole screen

  screen: {
    flex: 1,
    // fill full height

    backgroundColor: "#4F98DC",
    // app theme blue background

    paddingTop: Platform.OS === "ios" ? 54 : 18,
    // top padding for iPhone notch
  },

  header: {
    height: 54,
    // header height

    paddingHorizontal: 16,
    // header horizontal padding

    flexDirection: "row",
    // row layout

    alignItems: "center",
    // vertically center children

    justifyContent: "space-between",
    // spread left/title/right
  },

  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  // back button hit area

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  // header title style

  infoText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  // info text style (Loading... or empty list message)

  card: {
    flexDirection: "row",
    // row layout for image + text + arrow

    alignItems: "center",
    // center vertically

    gap: 12,
    // space between thumb and text

    padding: 12,
    // inside padding

    borderRadius: 18,
    // rounded corners

    backgroundColor: "rgba(255,255,255,0.16)",
    // card background

    borderWidth: 1,
    // border line

    borderColor: "rgba(255,255,255,0.22)",
    // border color
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
  // thumbnail container

  thumbImg: {
    width: "100%",
    height: "100%",
  },
  // thumbnail image fills container

  title: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 4,
  },
  // item title style

  sub: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },
  // item description style
});
