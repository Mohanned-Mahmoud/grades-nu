import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  GRADES_BASELINE: "grades_baseline",
  LAST_CHECKED: "last_checked",
  POLL_INTERVAL: "poll_interval",
  NOTIFICATIONS_ENABLED: "notifications_enabled",
  NEW_GRADES: "new_grades",
};

export interface GradeItem {
  courseCode: string;
  courseName: string;
  credits: string;
  grade: string;
  midtermGrade: string;
  points: string;
  section: string;
  subType: string;
}

export async function getGradesBaseline(): Promise<GradeItem[]> {
  const raw = await AsyncStorage.getItem(KEYS.GRADES_BASELINE);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setGradesBaseline(grades: GradeItem[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.GRADES_BASELINE, JSON.stringify(grades));
}

export async function getLastChecked(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.LAST_CHECKED);
}

export async function setLastChecked(timestamp: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.LAST_CHECKED, timestamp);
}

export async function getPollInterval(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.POLL_INTERVAL);
  return raw ? parseInt(raw, 10) : 30;
}

export async function setPollInterval(minutes: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.POLL_INTERVAL, String(minutes));
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.NOTIFICATIONS_ENABLED);
  return raw !== "false";
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, String(enabled));
}

export async function getNewGrades(): Promise<GradeItem[]> {
  const raw = await AsyncStorage.getItem(KEYS.NEW_GRADES);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setNewGrades(grades: GradeItem[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.NEW_GRADES, JSON.stringify(grades));
}

export function compareGrades(baseline: GradeItem[], current: GradeItem[]): GradeItem[] {
  const baselineMap = new Map(baseline.map((g) => [g.courseCode, g.grade]));
  return current.filter((g) => {
    const prev = baselineMap.get(g.courseCode);
    return prev === undefined || prev !== g.grade;
  });
}
