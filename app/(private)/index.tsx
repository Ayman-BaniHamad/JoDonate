// Import Ionicons icon set from Expo Vector Icons (used for category icons + nav icons)
import { Ionicons } from "@expo/vector-icons";

// Import router hook from expo-router to navigate between screens
import { useRouter } from "expo-router";

// Import React + hooks we use (useMemo for memoizing, useState for state)
import React, { useMemo, useState } from "react";

// Import React Native UI components used in this screen
import {
  FlatList,     // Efficient list/grid rendering
  Platform,     // Detect iOS vs Android for styling differences
  Pressable,    // Touchable component with press handling
  StyleSheet,   // Creates optimized styles object
  Text,         // Displays text
  TextInput,    // Input field for search
  View,         // Container/layout component
} from "react-native";

// Define a TypeScript type for a category item
// Each category has:
// - key: unique id used by FlatList
// - label: visible text (Books, Electronics, etc.)
// - icon: an Ionicons icon name (restricted by Ionicons glyph map for type safety)
type Category = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// Export default screen component for the Home screen in the private area
export default function HomeScreen() {

  // Create router instance for navigation
  const router = useRouter();

  // query holds the current search text typed by the user
  const [query, setQuery] = useState("");

  // categories list is memoized so it does NOT get recreated on every render
  // This improves performance, especially if the screen re-renders often
  const categories: Category[] = useMemo(
    () => [
      { key: "books", label: "Books", icon: "book-outline" },
      { key: "furniture", label: "Furniture", icon: "bed-outline" },
      { key: "clothes", label: "Clothes", icon: "shirt-outline" },
      { key: "electronics", label: "Electronics", icon: "tv-outline" },
      { key: "accessories", label: "Accessories", icon: "watch-outline" },
      { key: "plants", label: "Plants", icon: "leaf-outline" },
    ],
    [] // empty dependency array means it runs once and stays stable
  );

  // filtered categories depend on query and categories
  // useMemo prevents recalculating unless query/categories change
  const filtered = useMemo(() => {

    // Remove extra spaces and lowercase the query for case-insensitive searching
    const q = query.trim().toLowerCase();

    // If query is empty, show all categories
    if (!q) return categories;

    // Otherwise return categories whose label contains the search query
    return categories.filter((c) => c.label.toLowerCase().includes(q));

  }, [categories, query]); // recompute only if categories or query changes

  // Screen UI return
  return (
    // Root screen container
    <View style={styles.screen}>

      {/* Header section */}
      <View style={styles.header}>
        {/* Title text in the header */}
        <Text style={styles.headerTitle}>Home</Text>
      </View>

      {/* Search input container */}
      <View style={styles.searchWrap}>

        {/* Search icon */}
        <Ionicons name="search-outline" size={18} color={stylesVars.textSoft} />

        {/* Search input field */}
        <TextInput
          value={query} // displayed value comes from state
          onChangeText={setQuery} // updates query state on typing
          placeholder="Search" // placeholder when empty
          placeholderTextColor={stylesVars.textSoft} // placeholder color
          style={styles.searchInput} // styling
          returnKeyType="search" // keyboard shows "search" action
        />
      </View>

      {/* Grid list of categories */}
      <FlatList
        data={filtered} // list uses filtered categories, not full list
        keyExtractor={(item) => item.key} // unique key for each category
        numColumns={2} // render as a 2-column grid
        contentContainerStyle={styles.grid} // padding for the whole grid
        columnWrapperStyle={styles.row} // styling for each row (space-between)
        showsVerticalScrollIndicator={false} // hide scroll bar
        renderItem={({ item }) => (

          // Each category is clickable
          <Pressable
            onPress={() => {

              // Navigate to category screen when a category card is pressed
              // Example route: /category/[name]
              // We pass the category label as the "name" param
              router.push({
                pathname: "/category/[name]",
                params: { name: item.label }, // "Electronics", "Books", etc.
              });
            }}
            style={styles.card} // card styles
          >

            {/* Circle icon background */}
            <View style={styles.iconCircle}>
              {/* Category icon */}
              <Ionicons name={item.icon} size={30} color={stylesVars.text} />
            </View>

            {/* Category label */}
            <Text style={styles.cardLabel}>{item.label}</Text>

          </Pressable>
        )}
      />

      {/* Bottom Navigation bar */}
      <View style={styles.bottomNav}>

        {/* Home tab */}
        <Pressable style={styles.navItem}>
          {/* Home icon */}
          <Ionicons name="home" size={22} color={stylesVars.text} />
          {/* Home label */}
          <Text style={styles.navLabel}>Home</Text>
        </Pressable>

        {/* Profile tab navigates to /profile */}
        <Pressable style={styles.navItem} onPress={() => router.push("/profile")}>
          <Ionicons name="person-outline" size={22} color={stylesVars.text} />
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>

        {/* Spacer creates room in the middle for the floating + button */}
        <View style={{ width: 72 }} />

        {/* Notifications tab navigates to /notifications */}
        <Pressable style={styles.navItem} onPress={() => router.push("/notifications")}>
          <Ionicons name="notifications-outline" size={22} color={stylesVars.text} />
          <Text style={styles.navLabel}>Notifications</Text>
        </Pressable>

        {/* Chats tab navigates to /chats (you made it "coming soon" there) */}
        <Pressable style={styles.navItem} onPress={() => router.push("/chats")}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={stylesVars.text} />
          <Text style={styles.navLabel}>Chats</Text>
        </Pressable>
      </View>

      {/* Floating add (+) button to create new item */}
      <Pressable onPress={() => router.push("/add-item")} style={styles.fab}>
        {/* Plus icon */}
        <Ionicons name="add" size={30} color={stylesVars.bg} />
      </Pressable>

    </View>
  );
}

// Shared colors & constants used by styles
const stylesVars = {
  bg: "#4F98DC", // background blue
  text: "#FFFFFF", // main white text
  textSoft: "rgba(255,255,255,0.75)", // lighter white text
  card: "rgba(255,255,255,0.16)", // translucent white card background
  cardBorder: "rgba(255,255,255,0.25)", // translucent card border
  shadow: "rgba(0,0,0,0.18)", // shadow color
};

// Stylesheet object (React Native optimized styles)
const styles = StyleSheet.create({

  // Full screen styling
  screen: {
    flex: 1, // take full available height
    backgroundColor: stylesVars.bg, // apply blue background
    paddingTop: Platform.OS === "ios" ? 54 : 22, // more top padding on iOS
  },

  // Header container style
  header: {
    alignItems: "center", // center header contents horizontally
    paddingVertical: 10, // top/bottom padding
  },

  // Header title style
  headerTitle: {
    color: stylesVars.text, // white
    fontSize: 22, // large title
    fontWeight: "800", // heavy bold
  },

  // Search bar wrapper style
  searchWrap: {
    marginTop: 8, // spacing below header
    marginHorizontal: 18, // left/right spacing
    height: 48, // fixed height
    borderRadius: 14, // rounded corners
    paddingHorizontal: 12, // inner padding
    flexDirection: "row", // icon + input side by side
    alignItems: "center", // vertically centered
    backgroundColor: "rgba(255,255,255,0.14)", // translucent background
    borderWidth: 1, // border around
    borderColor: "rgba(255,255,255,0.18)", // border color
  },

  // Search text input style
  searchInput: {
    flex: 1, // input takes remaining space
    marginLeft: 8, // gap after icon
    color: stylesVars.text, // white text
    fontSize: 15,
  },

  // Grid list container padding
  grid: {
    paddingHorizontal: 18, // left/right spacing
    paddingTop: 18, // spacing at top
    paddingBottom: 110, // bottom spacing so nav bar doesn’t cover content
  },

  // Row wrapper style inside FlatList (for 2-column spacing)
  row: {
    justifyContent: "space-between", // spread the 2 cards apart
    marginBottom: 16, // spacing between rows
  },

  // Category card style
  card: {
    width: "48%", // fits 2 cards per row with spacing
    aspectRatio: 1, // makes card square
    borderRadius: 18, // round corners
    backgroundColor: stylesVars.card, // translucent background
    borderWidth: 1,
    borderColor: stylesVars.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4, // Android shadow
  },

  // Icon circle background style
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 999, // full circle
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 10, // space before label text
  },

  // Card label text style
  cardLabel: {
    color: stylesVars.text,
    fontWeight: "700",
    fontSize: 14,
  },

  // Bottom navigation container
  bottomNav: {
    position: "absolute", // sits above screen content
    left: 0,
    right: 0,
    bottom: 0,
    height: 86, // nav height
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 22 : 14, // extra padding for iOS bottom safe area
    paddingTop: 10,
    flexDirection: "row", // nav items in a row
    justifyContent: "space-between", // spread items across the bar
    alignItems: "flex-end", // align items at bottom
    backgroundColor: "rgba(255,255,255,0.14)", // translucent background
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
  },

  // Nav item style (icon + text)
  navItem: {
    width: 72, // fixed width for consistent spacing
    alignItems: "center",
    justifyContent: "center",
    gap: 4, // spacing between icon and text
  },

  // Nav label style
  navLabel: {
    color: stylesVars.text,
    fontSize: 10,
    fontWeight: "700",
  },

  // Floating add button style
  fab: {
    position: "absolute",
    bottom: 44, // sits above the nav bar
    alignSelf: "center", // centered horizontally
    width: 66,
    height: 66,
    borderRadius: 999, // circle
    backgroundColor: stylesVars.text, // white button
    alignItems: "center",
    justifyContent: "center",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
 /*This file implements the Home screen for the private area of the app.
It features a search bar to filter categories, a grid of category cards,
and a bottom navigation bar with tabs for Home, Profile, Notifications, and Chats.
A floating add button allows users to create new items.
The screen uses React Native components and Expo Router for navigation.
*/