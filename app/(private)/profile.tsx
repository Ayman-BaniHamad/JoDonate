import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { signOut } from "firebase/auth";
import { collection, doc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";

import { auth, db, storage } from "@/lib/firebase";

export default function ProfileScreen() {
  const router = useRouter();
  const firebaseUser = auth.currentUser;

  const [name, setName] = useState<string>("Loading...");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const email = firebaseUser?.email ?? "No email";

  const [stats, setStats] = useState({
    listed: 0,
    donated: 0,
    requests: 0, // pending received
  });

  // ✅ Live user profile (name + avatarUrl)
  useEffect(() => {
    if (!firebaseUser) {
      setName("Unknown User");
      setAvatarUrl("");
      return;
    }

    const userRef = doc(db, "users", firebaseUser.uid);

    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setName("User");
          setAvatarUrl("");
          return;
        }
        const data = snap.data() as any;
        setName(data?.name ?? "User");
        setAvatarUrl(data?.avatarUrl ?? "");
      },
      (err) => {
        console.log("Profile user doc error:", err);
        setName("User");
        setAvatarUrl("");
      }
    );

    return unsub;
  }, [firebaseUser?.uid]);

  // ✅ Live stats
  useEffect(() => {
    if (!firebaseUser) return;

    const itemsListedQ = query(collection(db, "items"), where("ownerId", "==", firebaseUser.uid));
    const itemsDonatedQ = query(
      collection(db, "items"),
      where("ownerId", "==", firebaseUser.uid),
      where("status", "==", "donated")
    );
    const requestsPendingQ = query(
      collection(db, "requests"),
      where("itemOwnerId", "==", firebaseUser.uid),
      where("status", "==", "pending")
    );

    const unsubListed = onSnapshot(itemsListedQ, (snap) =>
      setStats((prev) => ({ ...prev, listed: snap.size }))
    );
    const unsubDonated = onSnapshot(itemsDonatedQ, (snap) =>
      setStats((prev) => ({ ...prev, donated: snap.size }))
    );
    const unsubRequests = onSnapshot(requestsPendingQ, (snap) =>
      setStats((prev) => ({ ...prev, requests: snap.size }))
    );

    return () => {
      unsubListed();
      unsubDonated();
      unsubRequests();
    };
  }, [firebaseUser?.uid]);

  const onLogoutPress = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/(onboarding)");
          } catch (e: any) {
            console.log("SignOut error:", e?.code, e?.message, e);
            Alert.alert("Logout error", `${e?.code ?? ""}\n${e?.message ?? "Unknown error"}`);
          }
        },
      },
    ]);
  };

  // ✅ Reliable URI -> Blob (Expo iOS/Android)
  const uriToBlob = (uri: string) =>
    new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error("Failed to convert URI to Blob"));
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

  const changeAvatar = async () => {
    if (!firebaseUser) {
      Alert.alert("Not signed in", "Please sign in again.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    try {
      const uri = result.assets[0]?.uri;
      if (!uri) return;

      // 1) Upload to Storage
      const blob = await uriToBlob(uri);
      const fileRef = ref(storage, `avatars/${firebaseUser.uid}.jpg`);
      await uploadBytes(fileRef, blob);
      // @ts-ignore
      blob.close?.();

      // 2) Get URL
      const url = await getDownloadURL(fileRef);

      // 3) Save to Firestore user doc
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        avatarUrl: url,
      });

      // UI will update automatically via onSnapshot
      Alert.alert("Updated", "Profile photo updated!");
    } catch (e: any) {
      console.log("Avatar upload error:", e);
      Alert.alert("Error", e?.message ?? "Failed to upload avatar.");
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Avatar + Name */}
      <View style={styles.profileTop}>
        <Pressable onPress={changeAvatar} style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={34} color={stylesVars.bg} />
          )}

          {/* small edit badge */}
          <View style={styles.editBadge}>
            <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
          </View>
        </Pressable>

        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.listed}</Text>
          <Text style={styles.statLabel}>Items listed</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.donated}</Text>
          <Text style={styles.statLabel}>Items donated</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.requests}</Text>
          <Text style={styles.statLabel}>Requests received</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        <MenuItem icon="cube-outline" label="My Items" onPress={() => router.push("/my-items")} />
        <MenuItem icon="chatbubble-ellipses-outline" label="My Requests" onPress={() => router.push("/my-requests")} />
        <MenuItem icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
        <MenuItem icon="log-out-outline" label="Logout" danger onPress={onLogoutPress} />
      </View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <View style={styles.menuLeft}>
        <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
          <Ionicons name={icon} size={18} color="#FFFFFF" />
        </View>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={danger ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.75)"}
      />
    </Pressable>
  );
}

const stylesVars = {
  bg: "#4F98DC",
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.78)",
  card: "rgba(255,255,255,0.16)",
  cardBorder: "rgba(255,255,255,0.22)",
  shadow: "rgba(0,0,0,0.18)",
  danger: "#E53935",
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stylesVars.bg,
    paddingTop: Platform.OS === "ios" ? 54 : 18,
    paddingHorizontal: 16,
  },

  header: {
    alignItems: "center",
    paddingVertical: 10,
  },
  headerTitle: {
    color: stylesVars.text,
    fontSize: 20,
    fontWeight: "800",
  },

  profileTop: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 18,
  },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  editBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  name: {
    color: stylesVars.text,
    fontSize: 18,
    fontWeight: "800",
  },
  email: {
    color: stylesVars.textSoft,
    fontSize: 13,
    marginTop: 4,
    fontWeight: "600",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  statCard: {
    width: "32%",
    backgroundColor: stylesVars.card,
    borderWidth: 1,
    borderColor: stylesVars.cardBorder,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  statNumber: {
    color: stylesVars.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  statLabel: {
    color: stylesVars.textSoft,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  menu: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 18,
    paddingVertical: 6,
  },
  menuItem: {
    height: 54,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDanger: {
    backgroundColor: "rgba(229,57,53,0.9)",
  },
  menuLabel: {
    color: stylesVars.text,
    fontSize: 14,
    fontWeight: "800",
  },
  menuLabelDanger: {
    color: "#FFFFFF",
  },
});
