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

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SignInScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    setError(null);

    const cleanEmail = email.trim();

    if (!cleanEmail || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, cleanEmail, password);

      // ✅ Success -> go to private area
      router.replace("/(private)");
    } catch (e: any) {
      // Helpful error messages
      if (e?.code === "auth/invalid-credential") setError("Wrong email or password.");
      else if (e?.code === "auth/user-not-found") setError("No account found for this email.");
      else if (e?.code === "auth/wrong-password") setError("Wrong email or password.");
      else if (e?.code === "auth/invalid-email") setError("Invalid email address.");
      else setError("Sign in failed. Please try again.");
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
          <Text style={styles.title}>Sign In</Text>

          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={stylesVars.icon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
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

          {/* Error message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={onSignIn}
            disabled={loading}
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          >
            <Ionicons name="arrow-forward" size={22} color={stylesVars.btnIcon} />
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Pressable onPress={() => router.push("/sign-up")}>
              <Text style={styles.footerLink}> Sign Up</Text>
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
  screen: {
    flex: 1,
    backgroundColor: stylesVars.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 80,
    alignItems: "center",
  },
  title: {
    color: stylesVars.text,
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 28,
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
  footerRow: {
    position: "absolute",
    bottom: 40,
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
