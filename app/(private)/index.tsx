import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth } from "../../lib/firebase";

type Category = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const categories: Category[] = useMemo(
    () => [
      { key: "books", label: "Books", icon: "book-outline" },
      { key: "furniture", label: "Furniture", icon: "bed-outline" },
      { key: "clothes", label: "Clothes", icon: "shirt-outline" },
      { key: "electronics", label: "Electronics", icon: "tv-outline" },
      { key: "accessories", label: "Accessories", icon: "watch-outline" },
      { key: "plants", label: "Plants", icon: "leaf-outline" },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.label.toLowerCase().includes(q));
  }, [categories, query]);

const onLogoutPress = () => {
  Alert.alert("Logout", "Are you sure you want to logout?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Logout",
      style: "destructive",
      onPress: async () => {
        try {
          await signOut(auth);              // ✅ real sign out
          router.replace("/(onboarding)");  // ✅ go to Sign In
        } catch {
          Alert.alert("Error", "Logout failed. Please try again.");
        }
      },
    },
  ]);
};


  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={stylesVars.textSoft} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={stylesVars.textSoft}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      {/* Grid */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.key}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
          onPress={() => {
  router.push({
    pathname: "/category/[name]",
    params: { name: item.label }, // "Electronics", "Books", etc.
  });
}}


            style={styles.card}
          >
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={30} color={stylesVars.text} />
            </View>
            <Text style={styles.cardLabel}>{item.label}</Text>
          </Pressable>
        )}
      />

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => router.replace("/(private)")}>
          <Ionicons name="home" size={22} color={stylesVars.text} />
          <Text style={styles.navLabel}>Home</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={() => router.push("/profile")}>
          <Ionicons name="person-outline" size={22} color={stylesVars.text} />
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>

        {/* Spacer for floating + */}
        <View style={{ width: 72 }} />

        <Pressable style={styles.navItem} onPress={() => router.push("/notifications")}>
          <Ionicons name="notifications-outline" size={22} color={stylesVars.text} />
          <Text style={styles.navLabel}>Notifications</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={onLogoutPress}>
          {/* ✅ Red icon background like Profile */}
          <View style={styles.logoutIconBox}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={[styles.navLabel, styles.logoutLabel]}>Logout</Text>
        </Pressable>
      </View>

      {/* Floating + Button */}
      <Pressable onPress={() => router.push("/add-item")} style={styles.fab}>
        <Ionicons name="add" size={30} color={stylesVars.bg} />
      </Pressable>
    </View>
  );
}

const stylesVars = {
  bg: "#4F98DC",
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.75)",
  card: "rgba(255,255,255,0.16)",
  cardBorder: "rgba(255,255,255,0.25)",
  shadow: "rgba(0,0,0,0.18)",
  danger: "#E53935",
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stylesVars.bg,
    paddingTop: Platform.OS === "ios" ? 54 : 22,
  },
  header: {
    alignItems: "center",
    paddingVertical: 10,
  },
  headerTitle: {
    color: stylesVars.text,
    fontSize: 22,
    fontWeight: "800",
  },
  searchWrap: {
    marginTop: 8,
    marginHorizontal: 18,
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: stylesVars.text,
    fontSize: 15,
  },
  grid: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 110, // space for bottom nav
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  card: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: stylesVars.card,
    borderWidth: 1,
    borderColor: stylesVars.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 10,
  },
  cardLabel: {
    color: stylesVars.text,
    fontWeight: "700",
    fontSize: 14,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 86,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 22 : 14,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
  },
  navItem: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navLabel: {
    color: stylesVars.text,
    fontSize: 10,
    fontWeight: "700",
  },
  logoutIconBox: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: stylesVars.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutLabel: {
    color: stylesVars.danger,
  },
  fab: {
    position: "absolute",
    bottom: 44,
    alignSelf: "center",
    width: 66,
    height: 66,
    borderRadius: 999,
    backgroundColor: stylesVars.text,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
