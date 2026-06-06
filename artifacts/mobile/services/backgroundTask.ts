import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { setAuthTokenGetter, setBaseUrl, getGradesReport } from "@workspace/api-client-react";
import {
  getGradesBaseline,
  setGradesBaseline,
  setLastChecked,
  getNotificationsEnabled,
  compareGrades,
  setNewGrades,
} from "./storageService";
import { sendGradeNotification } from "./notificationService";
import { getSecureItem } from "./secureStore";

export const BACKGROUND_TASK_NAME = "NU_GRADES_BACKGROUND_FETCH";

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    if (Platform.OS === "web") return BackgroundFetch.BackgroundFetchResult.NoData;

    const token = await getSecureItem("session_token");
    if (!token) return BackgroundFetch.BackgroundFetchResult.NoData;

    setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
    setAuthTokenGetter(() => token);

    const data = await getGradesReport();
    if (!data?.grades) return BackgroundFetch.BackgroundFetchResult.Failed;

    await setLastChecked(new Date().toISOString());

    const baseline = await getGradesBaseline();
    const notificationsEnabled = await getNotificationsEnabled();

    if (baseline.length === 0) {
      await setGradesBaseline(data.grades);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    const changed = compareGrades(baseline, data.grades);
    if (changed.length > 0) {
      if (notificationsEnabled) {
        for (const g of changed) {
          await sendGradeNotification(g.courseName, g.grade);
        }
      }
      await setNewGrades(changed);
      await setGradesBaseline(data.grades);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundFetch(intervalMinutes = 30): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Available ||
      status === BackgroundFetch.BackgroundFetchStatus.Restricted
    ) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
        minimumInterval: intervalMinutes * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {
    // Already registered or not supported in this environment
  }
}

export async function unregisterBackgroundFetch(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
  } catch {}
}
