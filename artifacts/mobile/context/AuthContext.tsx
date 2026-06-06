import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl, gradesLogin } from "@workspace/api-client-react";
import {
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from "@/services/secureStore";

export interface AuthContextType {
  sessionToken: string | null;
  displayName: string;
  username: string;
  isLoading: boolean;
  login: (token: string, name: string, user: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  silentReauth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  sessionToken: null,
  displayName: "",
  username: "",
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  silentReauth: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
    setAuthTokenGetter(() => tokenRef.current);
  }, []);

  useEffect(() => {
    tokenRef.current = sessionToken;
  }, [sessionToken]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getSecureItem("session_token");
        const name = (await AsyncStorage.getItem("display_name")) ?? "";
        const user = (await getSecureItem("username")) ?? "";
        if (token) {
          tokenRef.current = token;
          setSessionToken(token);
          setDisplayName(name);
          setUsername(user);
        }
      } catch {
        // Ignore errors during initial load
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(token: string, name: string, user: string, pass: string) {
    await setSecureItem("session_token", token);
    await setSecureItem("username", user);
    await setSecureItem("password", pass);
    await AsyncStorage.setItem("display_name", name);
    tokenRef.current = token;
    setSessionToken(token);
    setDisplayName(name);
    setUsername(user);
  }

  async function logout() {
    await deleteSecureItem("session_token");
    await deleteSecureItem("username");
    await deleteSecureItem("password");
    await AsyncStorage.removeItem("display_name");
    await AsyncStorage.removeItem("grades_baseline");
    tokenRef.current = null;
    setSessionToken(null);
    setDisplayName("");
    setUsername("");
  }

  const silentReauth = useCallback(async (): Promise<boolean> => {
    try {
      const user = await getSecureItem("username");
      const pass = await getSecureItem("password");
      if (!user || !pass) return false;
      const result = await gradesLogin({ username: user, password: pass });
      if (result.success && result.sessionToken) {
        await login(result.sessionToken, result.displayName ?? displayName, user, pass);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [displayName, login]);

  return (
    <AuthContext.Provider value={{ sessionToken, displayName, username, isLoading, login, logout, silentReauth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
