import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AuthLayout() {
  const { sessionToken, isLoading } = useAuth();

  if (isLoading) return null;

  if (sessionToken) return <Redirect href="/(tabs)/dashboard" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
