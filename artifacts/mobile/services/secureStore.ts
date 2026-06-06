/**
 * Platform-aware secure storage.
 * On native: uses expo-secure-store.
 * On web: falls back to AsyncStorage (not secure, but functional for dev/preview).
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "__sec_";

async function nativeGet(key: string): Promise<string | null> {
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function nativeSet(key: string, value: string): Promise<void> {
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(key, value);
}

async function nativeDelete(key: string): Promise<void> {
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(key);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(PREFIX + key);
  }
  return nativeGet(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(PREFIX + key, value);
    return;
  }
  await nativeSet(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(PREFIX + key);
    return;
  }
  await nativeDelete(key);
}
