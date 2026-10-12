import { Tabs, useRouter, usePathname } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { useEffect } from "react";
import BottomNav from "../../components/BottomNav";
import { View } from "react-native";

export default function TabLayout() {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/login");
    }
  }, [user, loading]);

  const isChatScreen = pathname.includes("group-chatroom") || pathname.includes("chat/");

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

      {/* Only show BottomNav if user exists and not on chat screens */}
      {user && !isChatScreen && <BottomNav />}
    </View>
  );
}