// Import React and hooks
import React, { useMemo, useState } from "react";

// Import React Native UI components used in this screen
import {
  View,                 // container layout
  Text,                 // text display
  StyleSheet,           // create optimized styles
  Pressable,            // touchable button
  TextInput,            // input field
  ScrollView,           // scroll container for the form
  KeyboardAvoidingView, // moves UI up when keyboard opens (iOS mostly)
  Platform,             // to check iOS vs Android
  Modal,                // category selection modal
  FlatList,             // list inside modal (categories)
  Image,                // show selected image preview
  Alert,                // popup alerts
} from "react-native";

// Router for navigation (go back, redirect, etc.)
import { useRouter } from "expo-router";

// Icons used in UI
import { Ionicons } from "@expo/vector-icons";

// Expo library for selecting images from phone gallery
import * as ImagePicker from "expo-image-picker";

// Firestore functions: add a new document, reference a collection, server timestamp
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

// Firebase Storage functions: create file reference, upload bytes, get file URL
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

// Firebase Cloud Functions: getFunctions instance, httpsCallable to call a function
import { getFunctions, httpsCallable } from "firebase/functions";

// Import initialized Firebase instances (auth, firestore db, storage)
import { auth, db, storage } from "@/lib/firebase";

// Define allowed category names as a TypeScript union (prevents invalid categories)
type CategoryKey =
  | "Books"
  | "Furniture"
  | "Clothes"
  | "Electronics"
  | "Accessories"
  | "Plants";

// Export default component for Add Item screen
export default function AddItemScreen() {

  // Router instance for navigation
  const router = useRouter();

  // Categories list memoized (created once)
  const categories = useMemo<CategoryKey[]>(
    () => ["Books", "Furniture", "Clothes", "Electronics", "Accessories", "Plants"],
    []
  );

  // imageUri = local phone URI (used only to preview image in the UI)
  const [imageUri, setImageUri] = useState<string | null>(null);

  // imageUrl = Firebase Storage URL (this is the public URL we store in Firestore + send to AI)
  const [imageUrl, setImageUrl] = useState<string>("");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Selected category (empty string = not selected yet)
  const [category, setCategory] = useState<CategoryKey | "">("");

  // User phone/contact number
  const [contactNumber, setContactNumber] = useState("");

  // submitting = true while Firestore saving is happening
  const [submitting, setSubmitting] = useState(false);

  // showCategoryModal = controls whether category picker modal is visible
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // AI UI state
  const [aiLoading, setAiLoading] = useState(false);      // true while AI function is running
  const [aiHint, setAiHint] = useState<string | null>(null); // message shown to user (AI suggested / failed...)

  // Upload state: true while uploading image to Storage
  const [imageUploading, setImageUploading] = useState(false);

  // Validation error messages (one per field)
  const [errImage, setErrImage] = useState<string | null>(null);
  const [errTitle, setErrTitle] = useState<string | null>(null);
  const [errDescription, setErrDescription] = useState<string | null>(null);
  const [errCategory, setErrCategory] = useState<string | null>(null);
  const [errContactNumber, setErrContactNumber] = useState<string | null>(null);

  // Helper to clear all errors before validating again
  const clearErrors = () => {
    setErrImage(null);
    setErrTitle(null);
    setErrDescription(null);
    setErrCategory(null);
    setErrContactNumber(null);
  };

  // ✅ Helper: convert a local device URI to a Blob
  // Firebase Storage uploadBytes needs Blob/Uint8Array/ArrayBuffer (not a URI string)
  const uriToBlob = (uri: string) =>
    new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();                // create network request object
      xhr.onload = () => resolve(xhr.response);        // when download succeeds, return the blob
      xhr.onerror = () => reject(new Error("Failed to convert URI to Blob")); // if fails, reject
      xhr.responseType = "blob";                       // important: return blob
      xhr.open("GET", uri, true);                      // fetch local file data
      xhr.send(null);                                  // start request
    });

  // Upload image to Firebase Storage and return its download URL
  const uploadImageAsync = async (uri: string, userId: string) => {

    // Convert local file to Blob
    const blob = await uriToBlob(uri);

    // Create a storage reference/path
    // Example: items/uid/1700000000000.jpg
    const fileRef = ref(storage, `items/${userId}/${Date.now()}.jpg`);

    // Upload the blob into Firebase Storage
    await uploadBytes(fileRef, blob);

    // Some environments support blob.close() to free memory (safe optional)
    // @ts-ignore
    blob.close?.();

    // Get the public download URL for the uploaded file
    return await getDownloadURL(fileRef);
  };

  // Call cloud function to categorize item based on image URL
  const runAICategorization = async (uploadedImageUrl: string) => {
    try {
      setAiLoading(true);                    // AI is running
      setAiHint("Analyzing image...");       // show hint to user

      // Get Firebase Functions instance (default region)
      const functions = getFunctions();

      // Prepare a callable function (must exist in Firebase Functions backend)
      const categorize = httpsCallable(functions, "categorizeItemFromImage");

      // Call the function and send the imageUrl as input
      const res: any = await categorize({ imageUrl: uploadedImageUrl });

      // Extract data returned by the cloud function
      const { category: suggestedCategory, aiUsed } = res.data || {};

      // If AI returns a valid category name we support, set it automatically
      if (suggestedCategory && categories.includes(suggestedCategory)) {
        setCategory(suggestedCategory);
      }

      // Show message depending on whether the AI model was used or fallback logic
      setAiHint(aiUsed ? "AI category suggested." : "AI couldn't categorize the item.");
    } catch (e) {
      // If function fails, log and show user message
      console.log("AI categorize error:", e);
      setAiHint("AI categorization failed.");
    } finally {
      // Stop AI loading state
      setAiLoading(false);
    }
  };

  // Pick image from user's device gallery
  const pickImage = async () => {

    // Clear previous errors first
    clearErrors();

    // Ensure user is signed in (we need user uid for storage path and ownership)
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Not signed in", "Please sign in again.");
      router.replace("/(onboarding)"); // send to login screens
      return;
    }

    // Ask permission to access gallery
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to upload an image.");
      return;
    }

    // Open image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // images only
      quality: 0.8,                                    // compress
      allowsEditing: true,                             // user can crop
      aspect: [1, 1],                                  // square crop UI
    });

    // If user cancelled selection, stop here
    if (result.canceled) return;

    // Extract the local URI of the selected image
    const uri = result.assets[0]?.uri ?? null;
    if (!uri) return;

    // Update preview image in UI
    setImageUri(uri);

    // Clear image error if it existed
    setErrImage(null);

    // Reset AI hint message
    setAiHint(null);

    try {
      // Start upload state
      setImageUploading(true);

      // Upload immediately to get public URL
      const url = await uploadImageAsync(uri, user.uid);

      // Save URL in state (used later for Firestore + AI)
      setImageUrl(url);

      // Run AI categorization using the uploaded public URL
      await runAICategorization(url);
    } catch (e: any) {
      // Handle upload/AI errors
      console.log("Image upload error:", e);
      Alert.alert("Error", e?.message ?? "Failed to upload image.");

      // Reset imageUrl to avoid saving item with missing image URL
      setImageUrl("");
    } finally {
      // Stop upload state
      setImageUploading(false);
    }
  };

  // Remove selected image and reset related fields
  const removeImage = () => {
    setImageUri(null);     // remove preview
    setImageUrl("");       // remove uploaded URL reference
    setAiHint(null);       // clear AI hint message
    setAiLoading(false);   // stop AI loading
    if (errImage) setErrImage(null); // clear image error if shown
  };

  // Validate form fields and set error messages
  const validate = () => {
    let ok = true;

    // Must have local preview + uploaded image URL
    // Because AI + Firestore rely on the Storage URL
    if (!imageUri || !imageUrl) {
      setErrImage("Please add an image");
      ok = false;
    }

    // Title required
    if (!title.trim()) {
      setErrTitle("Please add a title");
      ok = false;
    }

    // Description required
    if (!description.trim()) {
      setErrDescription("Please add a description");
      ok = false;
    }

    // Category required
    if (!category) {
      setErrCategory("Please select a category");
      ok = false;
    }

    // Contact validation: digits only + minimum length
    const digits = contactNumber.replace(/\D/g, "");
    if (!digits) {
      setErrContactNumber("Please add a contact number");
      ok = false;
    } else if (digits.length < 10) {
      setErrContactNumber("Please enter a valid contact number");
      ok = false;
    }

    return ok; // overall pass/fail
  };

  // Submit item to Firestore
  const onSubmit = async () => {

    // Clear old errors then validate again
    clearErrors();
    const ok = validate();
    if (!ok) return;

    // Ensure signed in user exists
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Not signed in", "Please sign in again.");
      router.replace("/(onboarding)");
      return;
    }

    try {
      // Start saving state
      setSubmitting(true);

      // Save new item as a Firestore document in collection "items"
      await addDoc(collection(db, "items"), {
        title: title.trim(),                 // item title
        description: description.trim(),     // item description
        category: category,                  // chosen or AI-suggested category
        contactNumber: contactNumber.trim(), // phone number
        imageUrl,                            // uploaded image URL from Storage
        ownerId: user.uid,                   // logged-in user is the owner
        status: "available",                 // initial status
        createdAt: serverTimestamp(),        // server time for sorting
      });

      // Confirmation
      Alert.alert("Success", "Item added successfully!");

      // Go back to previous screen
      router.back();
    } catch (e: any) {
      // Handle Firestore errors
      console.log("Save error:", e);
      Alert.alert("Error", e?.message ?? "Failed to add item. Please try again.");
    } finally {
      // Stop saving state
      setSubmitting(false);
    }
  };

  // UI rendering
  return (
    <View style={styles.screen}>

      {/* Header bar */}
      <View style={styles.header}>

        {/* Back button */}
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>

        {/* Screen title */}
        <Text style={styles.headerTitle}>Add Item</Text>

        {/* Placeholder space so title stays centered */}
        <View style={{ width: 34 }} />
      </View>

      {/* Keyboard avoiding wrapper (especially for iOS) */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >

        {/* ScrollView for the whole form */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Images label */}
          <Text style={styles.label}>Images</Text>

          {/* Image preview and delete button */}
          <View style={styles.imageWrapper}>

            {/* Image picker button */}
            <Pressable
              onPress={pickImage}                        // open picker on press
              style={styles.imagePickerBox}              // UI box style
              disabled={imageUploading}                  // disable while uploading
            >
              {imageUri ? (
                // Show selected image preview if exists
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              ) : (
                // Otherwise show placeholder icon
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={24} color={stylesVars.brand} />
                </View>
              )}
            </Pressable>

            {/* Remove image button (only if image exists) */}
            {imageUri ? (
              <Pressable onPress={removeImage} style={styles.removeBtn} hitSlop={10}>
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>

          {/* Upload progress text */}
          {imageUploading ? <Text style={styles.aiText}>Uploading image...</Text> : null}

          {/* AI hint text */}
          {aiHint ? <Text style={styles.aiText}>{aiHint}</Text> : null}

          {/* Image error */}
          {!!errImage && <Text style={styles.errorText}>{errImage}</Text>}

          {/* Title input */}
          <Text style={[styles.label, { marginTop: 14 }]}>Title</Text>
          <View style={styles.inputBox}>
            <TextInput
              value={title}                         // state value
              onChangeText={setTitle}               // update state
              placeholder="Title"
              placeholderTextColor={stylesVars.placeholder}
              style={styles.input}
            />
          </View>
          {!!errTitle && <Text style={styles.errorText}>{errTitle}</Text>}

          {/* Description input */}
          <Text style={[styles.label, { marginTop: 14 }]}>Description</Text>
          <View style={[styles.inputBox, styles.textAreaBox]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={stylesVars.placeholder}
              style={[styles.input, styles.textArea]}
              multiline                             // allow multi-line
              textAlignVertical="top"               // start from top in Android
            />
          </View>
          {!!errDescription && <Text style={styles.errorText}>{errDescription}</Text>}

          {/* Category dropdown */}
          <Text style={[styles.label, { marginTop: 14 }]}>Category</Text>
          <Pressable style={styles.dropdownBox} onPress={() => setShowCategoryModal(true)}>
            <Text style={[styles.dropdownText, !category && { color: stylesVars.placeholder }]}>
              {category ? category : "Select a category"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={stylesVars.textSoft} />
          </Pressable>
          {!!errCategory && <Text style={styles.errorText}>{errCategory}</Text>}

          {/* Contact number input */}
          <Text style={[styles.label, { marginTop: 14 }]}>Contact Number</Text>
          <View style={styles.contactRow}>
            <TextInput
              value={contactNumber}
              onChangeText={(text) => {
                setContactNumber(text);                 // update state
                if (errContactNumber) setErrContactNumber(null); // clear error while typing
              }}
              placeholder="Ex:0799999999"
              placeholderTextColor={stylesVars.placeholder}
              style={[styles.input, { flex: 1 }]}
              keyboardType="phone-pad"                  // numeric keyboard
            />
            <Ionicons name="chevron-forward" size={18} color={stylesVars.textSoft} />
          </View>
          {!!errContactNumber && <Text style={styles.errorText}>{errContactNumber}</Text>}

          {/* Submit button */}
          <Pressable
            style={[
              styles.submitBtn,
              (submitting || imageUploading || aiLoading) && { opacity: 0.7 }, // dim while busy
            ]}
            onPress={onSubmit}                          // save item
            disabled={submitting || imageUploading || aiLoading} // block clicks while busy
          >
            <Text style={styles.submitText}>
              {submitting ? "Saving..." : imageUploading ? "Uploading..." : "Add Item"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">

        {/* Clicking outside closes the modal */}
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCategoryModal(false)}>

          {/* Inner card - stop click bubbling by using empty onPress */}
          <Pressable style={styles.modalCard} onPress={() => {}}>

            <Text style={styles.modalTitle}>Select Category</Text>

            {/* Render list of categories */}
            <FlatList
              data={categories}
              keyExtractor={(item) => item} // category string is unique
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setCategory(item);                 // update selection
                    setShowCategoryModal(false);       // close modal
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>

                  {/* Show checkmark if this is selected */}
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

// Color variables (reused in styles)
const stylesVars = {
  bg: "#4F98DC",                 // screen background
  card: "#FFFFFF",               // card background
  brand: "#4F98DC",              // brand color (same as bg)
  textDark: "rgba(0,0,0,0.85)",  // dark text
  textSoft: "rgba(0,0,0,0.45)",  // soft text
  placeholder: "rgba(0,0,0,0.30)", // placeholder color
  error: "#E53935",              // error red
  shadow: "rgba(0,0,0,0.12)",    // shadow color
};

// Styles used in the UI
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stylesVars.bg,
    paddingTop: Platform.OS === "ios" ? 54 : 18, // extra top padding for iOS status bar
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
  aiText: {
    marginTop: 8,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    fontSize: 12,
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

//The fucntion of this file is to add new items to the database with image upload and AI categorization features.