import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGradesReport,
  getGetGradesReportQueryKey,
  type GradeItem,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { GradeCard } from "@/components/GradeCard";
import {
  getGradesBaseline,
  setGradesBaseline,
  setLastChecked,
  getNewGrades,
  setNewGrades,
  compareGrades,
} from "@/services/storageService";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { displayName, silentReauth } = useAuth();
  const queryClient = useQueryClient();
  const [newGradeCodes, setNewGradeCodes] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reauthInProgress, setReauthInProgress] = useState(false);
  const initialized = useRef(false);
  const reauthAttempted = useRef(false);

  const isWeb = Platform.OS === "web";
  const TAB_BAR_HEIGHT = isWeb ? 84 : 60;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetGradesReport({
    query: {
      queryKey: getGetGradesReportQueryKey(),
      retry: 0,
      refetchOnWindowFocus: false,
    },
  });

  // Auto-reauth when we get a 401 — transparent to the user
  useEffect(() => {
    if (!isError || reauthAttempted.current) return;
    const status = (error as { status?: number } | null)?.status;
    if (status !== 401) return;

    reauthAttempted.current = true;
    setReauthInProgress(true);
    silentReauth().then((ok) => {
      setReauthInProgress(false);
      if (ok) {
        queryClient.invalidateQueries({ queryKey: getGetGradesReportQueryKey() });
      }
    });
  }, [isError, error, silentReauth, queryClient]);

  useEffect(() => {
    (async () => {
      const stored = await getNewGrades();
      if (stored.length > 0) {
        setNewGradeCodes(new Set(stored.map((g) => g.courseCode)));
      }
    })();
  }, []);

  useEffect(() => {
    if (!data?.grades || initialized.current) return;
    initialized.current = true;

    (async () => {
      const baseline = await getGradesBaseline();
      const now = new Date().toISOString();
      await setLastChecked(now);
      setLastUpdated(now);

      if (baseline.length === 0) {
        await setGradesBaseline(data.grades);
      } else {
        const changed = compareGrades(baseline, data.grades);
        if (changed.length > 0) {
          setNewGradeCodes(new Set(changed.map((g) => g.courseCode)));
          await setNewGrades(changed);
          await setGradesBaseline(data.grades);
        }
      }
    })();
  }, [data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    initialized.current = false;
    reauthAttempted.current = false;
    await queryClient.invalidateQueries({ queryKey: getGetGradesReportQueryKey() });
    await refetch();
    setNewGradeCodes(new Set());
    await setNewGrades([]);
    setRefreshing(false);
  }, [queryClient, refetch]);

  const grades: GradeItem[] = data?.grades ?? [];

  const formatTime = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const webTopPad = isWeb ? 67 : 0;
  const webBottomPad = isWeb ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>
              {displayName ? `Hello, ${displayName.split(" ")[0]}` : "My Grades"}
            </Text>
            <Text style={styles.headerSub}>
              {grades.length > 0
                ? `${grades.length} course${grades.length !== 1 ? "s" : ""} this semester`
                : "NovaCampus Portal"}
            </Text>
          </View>
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.7 : 1 }]}
            testID="refresh-button"
          >
            <Ionicons name="refresh" size={22} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </View>

        {lastUpdated && (
          <Text style={styles.lastUpdated}>
            Updated {formatTime(lastUpdated)}
          </Text>
        )}

        {newGradeCodes.size > 0 && (
          <View style={styles.newBadgeBar}>
            <Ionicons name="notifications" size={14} color={colors.navyDark} />
            <Text style={styles.newBadgeBarText}>
              {newGradeCodes.size} new grade{newGradeCodes.size !== 1 ? "s" : ""} since last check
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      {isLoading || reauthInProgress ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.navy} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {reauthInProgress ? "Reconnecting…" : "Fetching your grades…"}
          </Text>
        </View>
      ) : isError && reauthAttempted.current ? (
        <View style={styles.centered}>
          <Ionicons name="wifi-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Could not load grades</Text>
          <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
            Session may have expired. Try signing out and back in.
          </Text>
          <Pressable
            onPress={onRefresh}
            style={[styles.retryBtn, { backgroundColor: colors.navy }]}
          >
            <Text style={[styles.retryBtnText, { color: "#fff" }]}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={grades}
          keyExtractor={(item) => item.courseCode}
          renderItem={({ item }) => (
            <GradeCard item={item} isNew={newGradeCodes.has(item.courseCode)} />
          )}
          scrollEnabled={!!grades.length}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16 + webBottomPad },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.navy}
              colors={[colors.navy]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="school-outline" size={56} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No grades yet
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Pull down to refresh or wait for grades to be posted.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  lastUpdated: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 4,
  },
  newBadgeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5A623",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  newBadgeBarText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#0F2545",
  },
  list: {
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  errorSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
