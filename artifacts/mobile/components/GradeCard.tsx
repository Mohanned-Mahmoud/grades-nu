import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { GradeItem } from "@/services/storageService";

interface GradeCardProps {
  item: GradeItem;
  isNew?: boolean;
}

function gradeColor(grade: string, colors: ReturnType<typeof useColors>): string {
  const g = grade.trim().toUpperCase();
  if (!g || g === "N/A" || g === "-" || g === "") return colors.mutedForeground;
  if (g.startsWith("A")) return colors.success;
  if (g.startsWith("B")) return "#4ADE80";
  if (g.startsWith("C")) return colors.gold;
  if (g.startsWith("D")) return "#FB923C";
  if (g === "F" || g === "FAIL" || g === "W") return colors.danger;
  return colors.mutedForeground;
}

export function GradeCard({ item, isNew = false }: GradeCardProps) {
  const colors = useColors();

  const gradeClr = gradeColor(item.grade, colors);
  const midtermClr = gradeColor(item.midtermGrade, colors);
  const hasFinalGrade = item.grade && item.grade.trim() !== "";
  const hasMidterm = item.midtermGrade && item.midtermGrade.trim() !== "";

  const sectionLabel = [item.courseCode, item.section].filter(Boolean).join(" §");
  const metaLabel = [sectionLabel, item.credits ? `${item.credits} cr` : ""].filter(Boolean).join(" · ");

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {isNew && (
        <View style={[styles.newBadge, { backgroundColor: colors.gold }]}>
          <Text style={[styles.newBadgeText, { color: colors.navyDark }]}>NEW</Text>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={[styles.courseName, { color: colors.foreground }]} numberOfLines={2}>
            {item.courseName || "—"}
          </Text>
          <Text style={[styles.courseCode, { color: colors.mutedForeground }]}>
            {metaLabel}
          </Text>

          {hasMidterm && !hasFinalGrade && (
            <View style={styles.midtermRow}>
              <Text style={[styles.midtermLabel, { color: colors.mutedForeground }]}>Midterm</Text>
              <Text style={[styles.midtermGrade, { color: midtermClr }]}>{item.midtermGrade}</Text>
            </View>
          )}
        </View>

        <View style={styles.gradeContainer}>
          {hasFinalGrade ? (
            <>
              <Text style={[styles.grade, { color: gradeClr }]}>{item.grade}</Text>
              {item.points ? (
                <Text style={[styles.points, { color: colors.mutedForeground }]}>{item.points} pts</Text>
              ) : null}
              {hasMidterm && (
                <Text style={[styles.midtermSmall, { color: colors.mutedForeground }]}>
                  Mid: {item.midtermGrade}
                </Text>
              )}
            </>
          ) : (
            <View style={[styles.soonBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.soonText, { color: colors.mutedForeground }]}>Soon</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  newBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  info: {
    flex: 1,
  },
  courseName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  midtermRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  midtermLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  midtermGrade: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  gradeContainer: {
    alignItems: "flex-end",
  },
  grade: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    lineHeight: 32,
  },
  points: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  midtermSmall: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  soonBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  soonText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
});
