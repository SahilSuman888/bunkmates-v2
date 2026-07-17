import { Tabs, useRouter } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { useEffect } from "react";
import BottomNav from "../../components/BottomNav";
import { View } from "react-native";

export default function TabLayout() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/login");
    }
  }, [user, loading]);

  // ⚠️ IMPORTANT:
  // Never return null before mounting Tabs.
  // Always mount Tabs to keep navigation state stable.

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="trips" />
        <Tabs.Screen name="notes" />
        <Tabs.Screen name="reminders" />
        <Tabs.Screen name="chats" />
      </Tabs>

      {/* Only show BottomNav if user exists */}
      {user && <BottomNav />}
    </View>
  );
}