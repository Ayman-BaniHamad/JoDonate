import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

type CategoryKey =
  | "Books"
  | "Furniture"
  | "Clothes"
  | "Electronics"
  | "Accessories"
  | "Plants";

export default function AddItemScreen() {
  const router = useRouter();

  const categories = useMemo<CategoryKey[]>(
    () => ["Books", "Furniture", "Clothes", "Electronics", "Accessories", "Plants"],
    []
  );

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryKey | "">("");
  const [contactNumber, setContactNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Validation errors
  const [errImage, setErrImage] = useState<string | null>(null);
  const [errTitle, setErrTitle] = useState<string | null>(null);
  const [errDescription, setErrDescription] = useState<string | null>(null);
  const [errCategory, setErrCategory] = useState<string | null>(null);
  const [errContactNumber, setErrContactNumber] = useState<string | null>(null);

  const clearErrors = () => {
    setErrImage(null);
    setErrTitle(null);
    setErrDescription(null);
    setErrCategory(null);
    setErrContactNumber(null);
  };

  const pickImage = async () => {
    clearErrors();

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to upload an image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // ok for now (deprecation warning can be fixed later)
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setImageUri(result.assets[0]?.uri ?? null);
    }
  };

  const removeImage = () => {
    setImageUri(null);
    if (errImage) setErrImage(null);
  };

  // ✅ Reliable URI -> Blob (works in Expo iOS/Android)
  const uriToBlob = (uri: string) =>
    new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error("Failed to convert URI to Blob"));
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

  const uploadImageAsync = async (uri: string, userId: string) => {
    const blob = await uriToBlob(uri);

    // You can change the path if you want
    const fileRef = ref(storage, `items/${userId}/${Date.now()}.jpg`);

    await uploadBytes(fileRef, blob);

    // @ts-ignore (some envs have close)
    blob.close?.();

    return await getDownloadURL(fileRef);
  };

  const validate = () => {
    let ok = true;

    if (!imageUri) {
      setErrImage("Please add an image");
      ok = false;
    }
    if (!title.trim()) {
      setErrTitle("Please add a title");
      ok = false;
    }
    if (!description.trim()) {
      setErrDescription("Please add a description");
      ok = false;
    }
    if (!category) {
      setErrCategory("Please select a category");
      ok = false;
    }

    const digits = contactNumber.replace(/\D/g, "");
    if (!digits) {
      setErrContactNumber("Please add a contact number");
      ok = false;
    } else if (digits.length < 9) {
      setErrContactNumber("Please enter a valid contact number");
      ok = false;
    }

    return ok;
  };

  const onSubmit = async () => {
    clearErrors();
    const ok = validate();
    if (!ok) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Not signed in", "Please sign in again.");
      router.replace("/(onboarding)");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Upload image -> get public URL
      const imageUrl = await uploadImageAsync(imageUri!, user.uid);

      // 2) Save item to Firestore
      await addDoc(collection(db, "items"), {
        title: title.trim(),
        description: description.trim(),
        category: category,
        contactNumber: contactNumber.trim(),
        imageUrl, // ✅ public URL
        ownerId: user.uid,
        status: "available",
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Item added successfully!");
      router.back();
    } catch (e: any) {
      console.log("Upload/save error:", e);
      Alert.alert("Error", e?.message ?? "Failed to add item. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Add Item</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Images */}
          <Text style={styles.label}>Images</Text>

          <View style={styles.imageWrapper}>
            <Pressable onPress={pickImage} style={styles.imagePickerBox}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={24} color={stylesVars.brand} />
                </View>
              )}
            </Pressable>

            {imageUri ? (
              <Pressable onPress={removeImage} style={styles.removeBtn} hitSlop={10}>
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>

          {!!errImage && <Text style={styles.errorText}>{errImage}</Text>}

          {/* Title */}
          <Text style={[styles.label, { marginTop: 14 }]}>Title</Text>
          <View style={styles.inputBox}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={stylesVars.placeholder}
              style={styles.input}
            />
          </View>
          {!!errTitle && <Text style={styles.errorText}>{errTitle}</Text>}

          {/* Description */}
          <Text style={[styles.label, { marginTop: 14 }]}>Description</Text>
          <View style={[styles.inputBox, styles.textAreaBox]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={stylesVars.placeholder}
              style={[styles.input, styles.textArea]}
              multiline
              textAlignVertical="top"
            />
          </View>
          {!!errDescription && <Text style={styles.errorText}>{errDescription}</Text>}

          {/* Category */}
          <Text style={[styles.label, { marginTop: 14 }]}>Category</Text>
          <Pressable style={styles.dropdownBox} onPress={() => setShowCategoryModal(true)}>
            <Text style={[styles.dropdownText, !category && { color: stylesVars.placeholder }]}>
              {category ? category : "Select a category"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={stylesVars.textSoft} />
          </Pressable>
          {!!errCategory && <Text style={styles.errorText}>{errCategory}</Text>}

          {/* Contact Number */}
          <Text style={[styles.label, { marginTop: 14 }]}>Contact Number</Text>
          <View style={styles.contactRow}>
            <TextInput
              value={contactNumber}
              onChangeText={(text) => {
                setContactNumber(text);
                if (errContactNumber) setErrContactNumber(null);
              }}
              placeholder="Ex:0799999999"
              placeholderTextColor={stylesVars.placeholder}
              style={[styles.input, { flex: 1 }]}
              keyboardType="phone-pad"
            />
            <Ionicons name="chevron-forward" size={18} color={stylesVars.textSoft} />
          </View>
          {!!errContactNumber && <Text style={styles.errorText}>{errContactNumber}</Text>}

          {/* Submit */}
          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitText}>{submitting ? "Saving..." : "Add Item"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCategoryModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select Category</Text>

            <FlatList
              data={categories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setCategory(item);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {category === item ? (
                    <Ionicons name="checkmark" size={18} color={stylesVars.brand} />
                  ) : null}
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const stylesVars = {
  bg: "#4F98DC",
  card: "#FFFFFF",
  brand: "#4F98DC",
  textDark: "rgba(0,0,0,0.85)",
  textSoft: "rgba(0,0,0,0.45)",
  placeholder: "rgba(0,0,0,0.30)",
  error: "#E53935",
  shadow: "rgba(0,0,0,0.12)",
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stylesVars.bg,
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  imageWrapper: {
    alignSelf: "flex-start",
  },
  removeBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerBox: {
    width: 58,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.22)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: stylesVars.card,
  },
  imagePlaceholder: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreview: {
    width: 58,
    height: 58,
    borderRadius: 12,
  },
  inputBox: {
    backgroundColor: stylesVars.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
    justifyContent: "center",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  input: {
    fontSize: 15,
    color: stylesVars.textDark,
  },
  textAreaBox: {
    height: 110,
    paddingTop: 12,
    paddingBottom: 12,
  },
  textArea: {
    height: "100%",
  },
  dropdownBox: {
    backgroundColor: stylesVars.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  dropdownText: {
    fontSize: 15,
    color: stylesVars.textDark,
  },
  contactRow: {
    backgroundColor: stylesVars.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  errorText: {
    marginTop: 6,
    color: stylesVars.error,
    fontSize: 12,
    fontWeight: "600",
  },
  submitBtn: {
    marginTop: 22,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  submitText: {
    backgroundColor: "#FFFFFF",
    color: "#4F98DC",
    fontWeight: "800",
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#4F98DC",
    borderRadius: 18,
    padding: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  modalItem: {
    height: 48,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalItemText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalSeparator: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
});
