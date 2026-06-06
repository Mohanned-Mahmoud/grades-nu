import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useGradesLogin } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { requestNotificationPermission } from "@/services/notificationService";
import { registerBackgroundFetch } from "@/services/backgroundTask";

const NAVY = "#1B3A6B";
const NAVY_DARK = "#0F2545";
const GOLD = "#F5A623";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { mutate: doLogin, isPending } = useGradesLogin({
    mutation: {
      onSuccess: async (data) => {
        if (data.success && data.sessionToken) {
          await login(data.sessionToken, data.displayName ?? "", username, password);
          await requestNotificationPermission();
          await registerBackgroundFetch(30);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace("/(tabs)/dashboard");
        } else {
          setError(data.error ?? "Invalid credentials. Please try again.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      },
      onError: () => {
        setError("Connection failed. Check your network and try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    },
  });

  function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    doLogin({ data: { username: username.trim(), password } });
  }

  return (
    <View style={[styles.container, { backgroundColor: NAVY_DARK }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
          {/* Logo */}
          <View style={styles.logoArea}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={styles.appTitle}>NU Grades</Text>
            <Text style={styles.appSubtitle}>NovaCampus Self-Service</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardSubtitle}>Use your NovaCampus credentials</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(t) => { setUsername(t); setError(""); }}
                placeholder="Enter username"
                placeholderTextColor="#A0AEC0"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                testID="username-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                placeholder="Enter password"
                placeholderTextColor="#A0AEC0"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                testID="password-input"
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.loginBtn, { opacity: pressed || isPending ? 0.85 : 1 }]}
              onPress={handleLogin}
              disabled={isPending}
              testID="login-button"
            >
              {isPending ? (
                <ActivityIndicator color={NAVY_DARK} size="small" />
              ) : (
                <Text style={styles.loginBtnText}>Sign in</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footer}>Nile University · Academic Portal</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  logoArea: {
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: NAVY,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6B7DA0",
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: NAVY,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#CAD5E8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#1A1A2E",
    backgroundColor: "#F8FAFC",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#DC2626",
  },
  loginBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: NAVY_DARK,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
  },
});
