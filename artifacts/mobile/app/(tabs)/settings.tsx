import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useGradesLogout } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  getPollInterval,
  setPollInterval,
  getNotificationsEnabled,
  setNotificationsEnabled,
} from "@/services/storageService";
import { registerBackgroundFetch } from "@/services/backgroundTask";
import { requestNotificationPermission } from "@/services/notificationService";

const POLL_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { displayName, username, logout } = useAuth();
  const [pollInterval, setPollIntervalState] = useState(30);
  const [notificationsOn, setNotificationsOn] = useState(true);

  const isWeb = Platform.OS === "web";
  const TAB_BAR_HEIGHT = isWeb ? 84 : 60;

  useEffect(() => {
    (async () => {
      const interval = await getPollInterval();
      const notifs = await getNotificationsEnabled();
      setPollIntervalState(interval);
      setNotificationsOn(notifs);
    })();
  }, []);

  const { mutate: doLogout, isPending: loggingOut } = useGradesLogout({
    mutation: {
      onSettled: async () => {
        await logout();
      },
    },
  });

  async function handlePollChange(minutes: number) {
    Haptics.selectionAsync();
    setPollIntervalState(minutes);
    await setPollInterval(minutes);
    await registerBackgroundFetch(minutes);
  }

  async function handleNotifToggle(value: boolean) {
    Haptics.selectionAsync();
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Enable notifications in Settings to receive grade alerts.",
        );
        return;
      }
    }
    setNotificationsOn(value);
    await setNotificationsEnabled(value);
  }

  function handleLogout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => doLogout(undefined),
      },
    ]);
  }

  const webTopPad = isWeb ? 67 : 0;
  const webBottomPad = isWeb ? 34 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16 + webBottomPad,
      }}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.navy,
            paddingTop: insets.top + (isWeb ? 67 : 12),
          },
        ]}
      >
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Profile */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.secondary }]}>
          <Ionicons name="person" size={28} color={colors.navy} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]} numberOfLines={1}>
            {displayName || "Student"}
          </Text>
          <Text style={[styles.profileUsername, { color: colors.mutedForeground }]} numberOfLines={1}>
            {username}
          </Text>
        </View>
      </View>

      {/* Notifications */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: colors.gold + "20" }]}>
              <Ionicons name="notifications" size={18} color={colors.gold} />
            </View>
            <View>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>Grade Alerts</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Notify when new grades appear
              </Text>
            </View>
          </View>
          <Switch
            value={notificationsOn}
            onValueChange={handleNotifToggle}
            trackColor={{ false: colors.border, true: colors.gold }}
            thumbColor="#FFFFFF"
            testID="notifications-toggle"
          />
        </View>
      </View>

      {/* Poll Interval */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CHECK FREQUENCY</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.rowLeft, { paddingBottom: 12 }]}>
          <View style={[styles.iconBox, { backgroundColor: colors.navy + "15" }]}>
            <Ionicons name="time" size={18} color={colors.navy} />
          </View>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Background Check</Text>
        </View>
        <View style={styles.pillRow}>
          {POLL_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor:
                    pollInterval === opt.value ? colors.navy : colors.secondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() => handlePollChange(opt.value)}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: pollInterval === opt.value ? "#fff" : colors.navy },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* About */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ABOUT</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <AboutRow icon="school" label="Portal" value="NovaCampus Self-Service" colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AboutRow icon="link" label="URL" value="register.nu.edu.eg" colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AboutRow icon="code-slash" label="Version" value="1.0.0" colors={colors} />
      </View>

      {/* Logout */}
      <Pressable
        style={({ pressed }) => [
          styles.logoutBtn,
          { backgroundColor: colors.destructive, opacity: pressed || loggingOut ? 0.8 : 1 },
        ]}
        onPress={handleLogout}
        disabled={loggingOut}
        testID="logout-button"
      >
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutText}>{loggingOut ? "Signing out…" : "Sign Out"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function AboutRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
          <Ionicons name={icon as any} size={16} color={colors.navy} />
        </View>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{label}</Text>
      </View>
      <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  profileUsername: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 12,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  pillText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 20,
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
});
