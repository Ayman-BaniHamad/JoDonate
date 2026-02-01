import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function SignUpScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignUp = async () => {
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }
    if (!cleanEmail || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      // 1) Create account in Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      // 2) Create user profile document in Firestore using UID as doc ID
      const uid = cred.user.uid;

      await setDoc(doc(db, "users", uid), {
        name: cleanName,
        email: cleanEmail,
        createdAt: serverTimestamp(),
      });

      // ✅ Success -> go to private area
      router.replace("/(private)");
    } catch (e: any) {
      if (e?.code === "auth/email-already-in-use") setError("This email is already in use.");
      else if (e?.code === "auth/invalid-email") setError("Invalid email address.");
      else if (e?.code === "auth/weak-password") setError("Password should be at least 6 characters.");
      else setError("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Sign Up</Text>

          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={stylesVars.icon} />
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={stylesVars.placeholder}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={stylesVars.icon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={stylesVars.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={stylesVars.icon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={stylesVars.placeholder}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={onSignUp}
            disabled={loading}
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          >
            <Ionicons name="arrow-forward" size={22} color={stylesVars.btnIcon} />
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable style={styles.socialBtn} onPress={() => {}}>
            <Text style={styles.socialText}>Continue with Google</Text>
          </Pressable>

          <Pressable style={styles.socialBtn} onPress={() => {}}>
            <Text style={styles.socialText}>Continue with Facebook</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.replace("/(onboarding)")}>
              <Text style={styles.footerLink}> Sign In</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const stylesVars = {
  bg: "#4F98DC",
  text: "#FFFFFF",
  card: "#FFFFFF",
  placeholder: "#4F98DC",
  icon: "#4F98DC",
  btn: "#FFFFFF",
  btnIcon: "#4F98DC",
  shadow: "#4F98DC",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stylesVars.bg },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 70,
    alignItems: "center",
  },
  title: {
    color: stylesVars.text,
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 26,
  },
  card: {
    width: "100%",
    borderRadius: 18,
    padding: 14,
    backgroundColor: stylesVars.card,
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "rgba(0,0,0,0.75)",
  },
  errorText: {
    marginTop: 10,
    color: "#E53935",
    fontWeight: "800",
    fontSize: 13,
  },
  primaryBtn: {
    marginTop: 16,
    width: 180,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: stylesVars.btn,
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  orRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 14,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  orText: {
    color: stylesVars.text,
    marginHorizontal: 10,
    fontWeight: "700",
    opacity: 0.9,
  },
  socialBtn: {
    width: "100%",
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: stylesVars.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  socialText: {
    color: "rgba(0,0,0,0.8)",
    fontWeight: "700",
  },
  footerRow: {
    position: "absolute",
    bottom: 34,
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    color: stylesVars.text,
    fontSize: 14,
    opacity: 0.95,
  },
  footerLink: {
    color: stylesVars.text,
    fontSize: 14,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
