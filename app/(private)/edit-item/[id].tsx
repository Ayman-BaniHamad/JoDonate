import React, { useEffect, useMemo, useState } from "react";
// React = core library
// useState = store component state
// useEffect = run side-effects (load item on mount / when id changes)
// useMemo = memoize computed values (categories list)

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  Image,
} from "react-native";
// View/Text = layout + text
// StyleSheet = create style object
// Pressable = clickable button/touchable
// TextInput = input fields
// Platform = detect iOS/Android (for top padding)
// Alert = popup dialogs
// ScrollView = scrollable content
// Modal = overlay popup (category selector)
// FlatList = list inside modal
// Image = show item image

import { Ionicons } from "@expo/vector-icons";
// Ionicons = icons used in header/buttons

import { useLocalSearchParams, useRouter } from "expo-router";
// useRouter = navigation (back, push)
// useLocalSearchParams = read route params like /edit-item/[id]

import { doc, getDoc, updateDoc } from "firebase/firestore";
// doc = reference to a Firestore document
// getDoc = read doc once
// updateDoc = update fields in a doc

import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
// ref = reference to a Storage file path
// uploadBytes = upload file bytes to Storage
// getDownloadURL = get a public download URL
// deleteObject = delete a file from Storage

import * as ImagePicker from "expo-image-picker";
// ImagePicker = pick image from phone gallery

import { auth, db, storage } from "@/lib/firebase";
// auth = Firebase Auth instance (current user)
// db = Firestore instance
// storage = Firebase Storage instance

type CategoryKey =
  | "Books"
  | "Furniture"
  | "Clothes"
  | "Electronics"
  | "Accessories"
  | "Plants";
// CategoryKey = allowed categories in the UI

type ItemDoc = {
  title: string; // item title
  description: string; // item description
  category: CategoryKey | string; // item category (string fallback)
  contactNumber?: string; // optional contact number
  ownerId: string; // UID of item owner (used for permission)
  imageUrl?: string; // optional image URL from Storage
};
// ItemDoc = shape of data stored in Firestore items collection

export default function EditItemScreen() {
  // Screen component for editing an existing item

  const router = useRouter();
  // router = navigation controller

  const { id } = useLocalSearchParams<{ id: string }>();
  // id = item document id from the URL ( /edit-item/[id] )

  const categories = useMemo<CategoryKey[]>(
    // useMemo avoids recreating the array on every render
    () => ["Books", "Furniture", "Clothes", "Electronics", "Accessories", "Plants"],
    // function that returns the categories
    []
    // dependency array empty => computed once per mount
  );

  const [loading, setLoading] = useState(true);
  // loading = show "Loading..." until item data is fetched

  const [saving, setSaving] = useState(false);
  // saving = disable save button while updating Firestore

  const [uploadingImage, setUploadingImage] = useState(false);
  // uploadingImage = disable image actions while uploading/removing

  const [title, setTitle] = useState("");
  // title input state

  const [description, setDescription] = useState("");
  // description input state

  const [category, setCategory] = useState<CategoryKey | "">("");
  // selected category state ("" means none selected)

  const [contactNumber, setContactNumber] = useState("");
  // contact number input state

  const [imageUrl, setImageUrl] = useState<string>("");
  // imageUrl = current image URL to display in UI

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  // showCategoryModal = open/close category selection modal

  // ✅ Reliable URI -> Blob (Expo iOS/Android)
  const uriToBlob = (uri: string) =>
    // Function converts local file URI (from ImagePicker) into a Blob for upload
    new Promise<Blob>((resolve, reject) => {
      // Promise wrapper because XMLHttpRequest is callback-based

      const xhr = new XMLHttpRequest();
      // xhr used to fetch the local file data

      xhr.onload = () => resolve(xhr.response);
      // when loaded, resolve with the response (blob)

      xhr.onerror = () => reject(new Error("Failed to convert URI to Blob"));
      // if any error, reject promise

      xhr.responseType = "blob";
      // tell xhr we want the response as a Blob

      xhr.open("GET", uri, true);
      // open a GET request to the local URI (async = true)

      xhr.send(null);
      // send the request
    });

  useEffect(() => {
    // Runs when `id` changes (or first mount)

    const load = async () => {
      // Async function to fetch item and fill the form

      if (!id) return;
      // If there is no id, we can't load anything

      try {
        setLoading(true);
        // show loading UI

        const snap = await getDoc(doc(db, "items", id));
        // read Firestore document items/{id}

        if (!snap.exists()) {
          // if item not found
          Alert.alert("Not found", "Item does not exist.");
          // show alert
          router.back();
          // go back
          return;
          // stop
        }

        const data = snap.data() as ItemDoc;
        // cast Firestore data to ItemDoc

        // Only owner can edit
        const currentUser = auth.currentUser;
        // current logged-in user

        if (!currentUser || data.ownerId !== currentUser.uid) {
          // if not signed in OR not the owner
          Alert.alert("Not allowed", "You can only edit your own items.");
          // show error
          router.back();
          // go back
          return;
          // stop
        }

        setTitle(data.title ?? "");
        // fill title input

        setDescription(data.description ?? "");
        // fill description input

        setCategory((data.category as CategoryKey) ?? "");
        // fill category (cast to CategoryKey)

        setContactNumber(data.contactNumber ?? "");
        // fill contact number

        setImageUrl(data.imageUrl ?? "");
        // fill imageUrl so it shows current image
      } catch (e) {
        // any error while loading (permissions/network)
        console.log("Edit load error:", e);
        // log details to console for debugging
        Alert.alert("Error", "Failed to load item.");
        // show user-friendly message
        router.back();
        // return to previous screen
      } finally {
        setLoading(false);
        // stop loading UI
      }
    };

    load();
    // call load() immediately
  }, [id]);
  // dependency = id. reload if user navigates to a different item id

  const changeItemImage = async () => {
    // Allows picking a new image and uploading it to Firebase Storage

    if (!id) return;
    // must have item id

    const currentUser = auth.currentUser;
    // get current logged-in user

    if (!currentUser) {
      // if not signed in
      Alert.alert("Not signed in", "Please sign in again.");
      // warn user
      return;
      // stop
    }

    // Permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // ask gallery permission

    if (status !== "granted") {
      // if user denied permission
      Alert.alert("Permission needed", "Please allow photo access.");
      // tell user
      return;
      // stop
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // open gallery picker UI
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // only images
      quality: 0.85,
      // compress a bit (balance quality/size)
      allowsEditing: true,
      // allow cropping
      aspect: [1, 1],
      // crop to square
    });

    if (result.canceled) return;
    // if user cancels selection, stop

    try {
      setUploadingImage(true);
      // lock UI while uploading

      const uri = result.assets[0]?.uri;
      // get the picked local file uri

      if (!uri) return;
      // guard: no uri

      // Upload new image
      const blob = await uriToBlob(uri);
      // convert local uri to Blob

      const fileRef = ref(storage, `item-images/${currentUser.uid}/${id}.jpg`);
      // create a Storage reference (fixed path per item)
      // path example: item-images/USER_UID/ITEM_ID.jpg

      await uploadBytes(fileRef, blob);
      // upload blob to Storage at the path

      // @ts-ignore
      blob.close?.();
      // some environments provide blob.close() to release resources (safe optional)

      const newUrl = await getDownloadURL(fileRef);
      // get public download URL of uploaded image

      // Update Firestore item
      await updateDoc(doc(db, "items", id), {
        imageUrl: newUrl,
      });
      // store newUrl in Firestore so other screens can read it

      // Update local UI immediately
      setImageUrl(newUrl);
      // update local state so image changes without reloading

      Alert.alert("Updated", "Item image updated!");
      // success message
    } catch (e: any) {
      // handle upload/update failures
      console.log("changeItemImage error:", e);
      // log technical info
      Alert.alert("Error", e?.message ?? "Failed to update image.");
      // show user-friendly error
    } finally {
      setUploadingImage(false);
      // unlock UI
    }
  };

  const removeItemImage = async () => {
    // Removes the item image (delete from Storage + clear Firestore field)

    if (!id) return;
    // must have id

    const currentUser = auth.currentUser;
    // current user

    if (!currentUser) {
      // user not signed in
      Alert.alert("Not signed in", "Please sign in again.");
      // show message
      return;
      // stop
    }

    Alert.alert("Remove image", "Remove the item image?", [
      // confirm popup before deleting

      { text: "Cancel", style: "cancel" },
      // cancel button

      {
        text: "Remove",
        // remove button label
        style: "destructive",
        // red destructive style (iOS)
        onPress: async () => {
          // runs if user confirms removal
          try {
            setUploadingImage(true);
            // lock UI while deleting

            // Best-effort delete from storage (we used a fixed path)
            const fileRef = ref(storage, `item-images/${currentUser.uid}/${id}.jpg`);
            // reference to the same fixed image path used during upload

            await deleteObject(fileRef).catch(() => {});
            // attempt delete in Storage; ignore errors (file might not exist)

            // Clear Firestore field
            await updateDoc(doc(db, "items", id), { imageUrl: "" });
            // set Firestore imageUrl to empty string

            setImageUrl("");
            // update local state

            Alert.alert("Removed", "Item image removed.");
            // success message
          } catch (e: any) {
            // handle errors
            console.log("removeItemImage error:", e);
            // log debug
            Alert.alert("Error", e?.message ?? "Failed to remove image.");
            // show user friendly error
          } finally {
            setUploadingImage(false);
            // unlock UI
          }
        },
      },
    ]);
  };

  const onSave = async () => {
    // Saves edited fields (title/description/category/contactNumber/imageUrl) to Firestore

    if (!id) return;
    // must have id

    if (!title.trim() || !description.trim() || !category) {
      // basic validation: must have these fields
      Alert.alert("Missing fields", "Please fill title, description, and category.");
      // show message
      return;
      // stop save
    }

    try {
      setSaving(true);
      // disable save button + show saving label

      await updateDoc(doc(db, "items", id), {
        title: title.trim(),
        // update title

        description: description.trim(),
        // update description

        category: category,
        // update category

        contactNumber: contactNumber.trim(),
        // update contact number

        // imageUrl is edited separately, but keeping it here is fine too:
        imageUrl: imageUrl,
        // keep whatever is in state (newUrl or empty)
      });

      Alert.alert("Saved", "Item updated successfully.");
      // show success message

      router.back();
      // go back to previous screen
    } catch (e) {
      // handle update failure
      console.log("Edit save error:", e);
      // log debug
      Alert.alert("Error", "Failed to update item.");
      // show user friendly message
    } finally {
      setSaving(false);
      // stop saving state
    }
  };

  return (
    <View style={styles.screen}>
      {/* Screen container */}

      <View style={styles.header}>
        {/* Header */}

        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          {/* Back button */}
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          {/* Back icon */}
        </Pressable>

        <Text style={styles.headerTitle}>Edit Item</Text>
        {/* Screen title */}

        <View style={{ width: 34 }} />
        {/* Right spacer so title stays centered */}
      </View>

      {loading ? (
        // If still loading item data
        <Text style={styles.infoText}>Loading...</Text>
      ) : (
        // Else show form
        <ScrollView contentContainerStyle={styles.content}>
          {/* Scrollable content */}

          {/* ✅ Image editor */}
          <Text style={styles.label}>Image</Text>
          {/* Section label */}

          <View style={styles.imageRow}>
            {/* Row: image box + buttons */}

            <Pressable
              onPress={changeItemImage}
              // tapping image box opens picker

              disabled={uploadingImage}
              // disable while uploading/removing

              style={[styles.imageBox, uploadingImage && { opacity: 0.7 }]}
              // dim while uploading
            >
              {imageUrl ? (
                // If there is an image URL, show it
                <Image source={{ uri: imageUrl }} style={styles.image} />
              ) : (
                // Otherwise show placeholder
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={26} color="#4F98DC" />
                  <Text style={styles.imageHint}>Tap to add</Text>
                </View>
              )}
            </Pressable>

            <View style={{ gap: 10 }}>
              {/* Column for Change/Upload and Remove buttons */}

              <Pressable
                onPress={changeItemImage}
                // change image button

                disabled={uploadingImage}
                // disable while uploading/removing

                style={[styles.smallBtn, uploadingImage && { opacity: 0.7 }]}
                // dim while uploading
              >
                <Text style={styles.smallBtnText}>
                  {imageUrl ? "Change" : "Upload"}
                  {/* If there is an image: "Change", else: "Upload" */}
                </Text>
              </Pressable>

              <Pressable
                onPress={removeItemImage}
                // remove image button

                disabled={uploadingImage || !imageUrl}
                // disable if uploading OR no image exists

                style={[
                  styles.smallBtn,
                  styles.smallBtnDanger,
                  (uploadingImage || !imageUrl) && { opacity: 0.45 },
                ]}
                // red button + dim when disabled
              >
                <Text style={styles.smallBtnText}>Remove</Text>
                {/* remove label */}
              </Pressable>
            </View>
          </View>

          <Text style={styles.label}>Title</Text>
          {/* Label: Title */}

          <View style={styles.inputBox}>
            {/* Input wrapper */}
            <TextInput
              value={title}
              // controlled input value

              onChangeText={setTitle}
              // update state when typing

              style={styles.input}
              // input style

              placeholder="Title"
              // placeholder text
            />
          </View>

          <Text style={styles.label}>Description</Text>
          {/* Label: Description */}

          <View style={[styles.inputBox, { height: 110, paddingTop: 10 }]}>
            {/* Taller input wrapper for multiline */}
            <TextInput
              value={description}
              // controlled value

              onChangeText={setDescription}
              // update state

              style={[styles.input, { height: "100%" }]}
              // style + fill wrapper height

              placeholder="Description"
              // placeholder

              multiline
              // allow multiline

              textAlignVertical="top"
              // start text from top (Android)
            />
          </View>

          {/* ✅ Category dropdown */}
          <Text style={styles.label}>Category</Text>
          {/* Label: Category */}

          <Pressable style={styles.dropdownBox} onPress={() => setShowCategoryModal(true)}>
            {/* Pressable opens modal */}
            <Text style={[styles.dropdownText, !category && { color: "rgba(0,0,0,0.35)" }]}>
              {/* If no category selected, show placeholder color */}
              {category ? category : "Select a category"}
              {/* text content depends on selected value */}
            </Text>
            <Ionicons name="chevron-down" size={18} color="rgba(0,0,0,0.45)" />
            {/* dropdown arrow icon */}
          </Pressable>

          <Text style={styles.label}>Contact Number</Text>
          {/* Label: contact number */}

          <View style={styles.inputBox}>
            {/* input wrapper */}
            <TextInput
              value={contactNumber}
              // controlled input

              onChangeText={setContactNumber}
              // update state

              style={styles.input}
              // input style

              placeholder="Contact Number"
              // placeholder

              keyboardType="phone-pad"
              // numeric phone keyboard on mobile
            />
          </View>

          <Pressable
            onPress={onSave}
            // save action

            disabled={saving}
            // disable while saving

            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            // dim when saving
          >
            <Text style={styles.saveText}>{saving ? "Saving..." : "Save Changes"}</Text>
            {/* dynamic label */}
          </Pressable>
        </ScrollView>
      )}

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        {/* Modal overlay shown when selecting category */}

        <Pressable style={styles.modalBackdrop} onPress={() => setShowCategoryModal(false)}>
          {/* Click outside modal closes it */}

          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* Prevent closing when tapping inside card */}

            <Text style={styles.modalTitle}>Select Category</Text>
            {/* Modal title */}

            <FlatList
              data={categories}
              // category options

              keyExtractor={(item) => item}
              // unique key = category name

              ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
              // line separator between options

              renderItem={({ item }) => (
                // render each category row
                <Pressable
                  style={styles.modalItem}
                  // row style

                  onPress={() => {
                    // when selecting a category
                    setCategory(item);
                    // save selection
                    setShowCategoryModal(false);
                    // close modal
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {/* category name */}

                  {category === item ? (
                    // show checkmark if currently selected
                    <Ionicons name="checkmark" size={18} color="#4F98DC" />
                  ) : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // StyleSheet object for the screen

  screen: {
    flex: 1,
    // full screen

    backgroundColor: "#4F98DC",
    // app blue background

    paddingTop: Platform.OS === "ios" ? 54 : 18,
    // top padding for iOS notch
  },

  header: {
    height: 54,
    // header height

    paddingHorizontal: 16,
    // horizontal padding

    flexDirection: "row",
    // row layout

    alignItems: "center",
    // vertically center items

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
  // back button styles

  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  // header title style

  infoText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  // loading text style

  content: { paddingHorizontal: 16, paddingBottom: 28 },
  // scroll content padding

  label: { color: "#FFFFFF", fontWeight: "800", marginTop: 14, marginBottom: 8 },
  // section label style

  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  // row layout for image and buttons

  imageBox: {
    width: 120,
    height: 120,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  // image container

  image: { width: "100%", height: "100%" },
  // image style

  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  // placeholder container

  imageHint: { marginTop: 6, color: "rgba(0,0,0,0.55)", fontWeight: "800", fontSize: 12 },
  // placeholder hint text

  smallBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  // small action button style

  smallBtnDanger: {
    backgroundColor: "rgba(229,57,53,0.9)",
    borderWidth: 0,
  },
  // red danger button style

  smallBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  // small button text

  inputBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
    justifyContent: "center",
  },
  // input wrapper (white box)

  input: { fontSize: 15, color: "rgba(0,0,0,0.85)" },
  // input text style

  dropdownBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // dropdown row style

  dropdownText: { fontSize: 15, color: "rgba(0,0,0,0.85)", fontWeight: "700" },
  // dropdown label text

  saveBtn: {
    marginTop: 20,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  // save button

  saveText: { color: "#4F98DC", fontWeight: "900", fontSize: 16 },
  // save button text

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  // dark overlay behind modal

  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#4F98DC",
    borderRadius: 18,
    padding: 14,
  },
  // modal container

  modalTitle: { fontSize: 16, fontWeight: "900", color: "#FFFFFF", marginBottom: 10 },
  // modal title text

  modalItem: {
    height: 48,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // category row

  modalItemText: { fontSize: 15, color: "#FFFFFF", fontWeight: "700" },
  // category row text

  modalSeparator: { height: 1, backgroundColor: "rgba(0,0,0,0.08)" },
  // separator line
});
