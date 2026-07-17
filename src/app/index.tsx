import { Redirect } from "expo-router";
import { useUser } from "../contexts/UserContext";

export default function Index() {
  const { user, loading } = useUser();

  if (loading) return null;

  return user ? (
    <Redirect href="/(tabs)/home" />
  ) : (
    <Redirect href="/login" />
  );
}