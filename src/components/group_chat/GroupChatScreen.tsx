import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface GroupChatProps {
  groups: any[];
  loading: boolean;
  onRefresh?: () => void;
}

export default function GroupChatScreen({ groups, loading, onRefresh }: GroupChatProps) {
  const router = useRouter();

  const renderGroup = ({ item }: any) => (
    <Pressable
      style={styles.groupItem}
      onPress={() => router.push(`/(tabs)/group-chatroom/${item.id}`)}
    >
      <Image
        source={{ uri: item.iconURL || "https://via.placeholder.com/60" }}
        style={styles.groupIcon}
      />
      <View style={styles.groupInfo}>
        <Text style={styles.groupName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.groupDescription} numberOfLines={1}>
          {item.description || `${item.members?.length || 1} members`}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#888" />
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#b36a22" />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="chat-multiple-outline" size={48} color="#666" />
        <Text style={styles.emptyText}>No group chats yet</Text>
        <Text style={styles.emptySubtext}>Join or create a group to get started</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={groups}
      renderItem={renderGroup}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      onRefresh={onRefresh}
      refreshing={loading}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0e0e0e",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0e0e0e",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupItem: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  groupIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  groupDescription: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
});
