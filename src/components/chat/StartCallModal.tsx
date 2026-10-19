import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useThemeToggle } from "../../contexts/ThemeContext";

interface StartCallModalProps {
  visible: boolean;
  onClose: () => void;
  bunkmates: any[];
  groups: any[];
  onStartSingleCall: (item: any, type: "audio" | "video") => void;
  onStartGroupCall: (group: any) => void;
  defaultCallType?: "audio" | "video";
}

export default function StartCallModal({
  visible,
  onClose,
  bunkmates,
  groups,
  onStartSingleCall,
  onStartGroupCall,
  defaultCallType = "audio",
}: StartCallModalProps) {
  const { accentColor } = useThemeToggle();
  const isBrightAccent =
    accentColor === "#FFFFFF" ||
    accentColor === "#ffffff" ||
    accentColor === "#f59e0b" ||
    accentColor === "#ffd700";
  const onAccentTextColor = isBrightAccent ? "#000000" : "#FFFFFF";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"bunkmates" | "groups">("bunkmates");

  const filteredBunkmates = useMemo(() => {
    if (!searchQuery.trim()) return bunkmates;
    const q = searchQuery.toLowerCase().trim();
    return bunkmates.filter(
      (b) =>
        (b.title || b.name || "").toLowerCase().includes(q) ||
        (b.rawItem?.username || "").toLowerCase().includes(q)
    );
  }, [bunkmates, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();
    return groups.filter((g) =>
      (g.title || g.name || "").toLowerCase().includes(q)
    );
  }, [groups, searchQuery]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={styles.handleBar} />

          {/* Top Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Start a Call</Text>
              <Text style={styles.headerSub}>
                Connect instantly with fellow travelers
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.7)" />
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="rgba(255, 255, 255, 0.4)" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or @username..."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor="#ffffff"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.5)" />
              </Pressable>
            )}
          </View>

          {/* Tab Switcher: Bunkmates / Groups (Dynamic accent) */}
          <View style={styles.tabSwitcher}>
            <Pressable
              style={[
                styles.tabSegment,
                activeTab === "bunkmates" && [
                  styles.tabSegmentActive,
                  { backgroundColor: accentColor },
                ],
              ]}
              onPress={() => {
                try {
                  Haptics.selectionAsync();
                } catch (e) {}
                setActiveTab("bunkmates");
              }}
            >
              <Ionicons
                name="person"
                size={13}
                color={activeTab === "bunkmates" ? onAccentTextColor : "rgba(255, 255, 255, 0.6)"}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.tabSegmentText,
                  activeTab === "bunkmates" && [
                    styles.tabSegmentTextActive,
                    { color: onAccentTextColor },
                  ],
                ]}
              >
                Bunkmates ({filteredBunkmates.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabSegment,
                activeTab === "groups" && [
                  styles.tabSegmentActive,
                  { backgroundColor: accentColor },
                ],
              ]}
              onPress={() => {
                try {
                  Haptics.selectionAsync();
                } catch (e) {}
                setActiveTab("groups");
              }}
            >
              <Ionicons
                name="people"
                size={14}
                color={activeTab === "groups" ? onAccentTextColor : "rgba(255, 255, 255, 0.6)"}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.tabSegmentText,
                  activeTab === "groups" && [
                    styles.tabSegmentTextActive,
                    { color: onAccentTextColor },
                  ],
                ]}
              >
                Groups ({filteredGroups.length})
              </Text>
            </Pressable>
          </View>

          {/* List Feed */}
          <ScrollView
            style={styles.listScrollView}
            contentContainerStyle={styles.listScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === "bunkmates" ? (
              filteredBunkmates.length > 0 ? (
                filteredBunkmates.map((item) => (
                  <View key={item.id} style={styles.contactRow}>
                    <ExpoImage
                      source={{
                        uri:
                          item.avatar ||
                          item.photoURL ||
                          "https://i.pravatar.cc/150?img=12",
                      }}
                      style={styles.contactAvatar}
                      contentFit="cover"
                    />

                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName} numberOfLines={1}>
                        {item.title || item.name || "Traveler"}
                      </Text>
                      <Text style={styles.contactSub} numberOfLines={1}>
                        {item.rawItem?.username
                          ? `@${item.rawItem.username}`
                          : "Available for call"}
                      </Text>
                    </View>

                    {/* Quick Call Action Buttons (White and Black accent) */}
                    <View style={styles.contactActions}>
                      <Pressable
                        style={styles.callCircleBtn}
                        onPress={() => {
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          } catch (e) {}
                          onClose();
                          onStartSingleCall(item, "audio");
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="call" size={16} color="#ffffff" />
                      </Pressable>

                      <Pressable
                        style={styles.callCircleBtn}
                        onPress={() => {
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          } catch (e) {}
                          onClose();
                          onStartSingleCall(item, "video");
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="videocam" size={17} color="#ffffff" />
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyWrap}>
                  <Feather name="user-x" size={32} color="rgba(255, 255, 255, 0.25)" />
                  <Text style={styles.emptyText}>No bunkmates found</Text>
                </View>
              )
            ) : filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <View key={group.id} style={styles.contactRow}>
                  <ExpoImage
                    source={{
                      uri:
                        group.avatar ||
                        group.iconURL ||
                        "https://i.pravatar.cc/150?img=50",
                    }}
                    style={styles.contactAvatar}
                    contentFit="cover"
                  />

                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName} numberOfLines={1}>
                      {group.title || group.name || "Trip Group"}
                    </Text>
                    <Text style={styles.contactSub} numberOfLines={1}>
                      Travel Group Call
                    </Text>
                  </View>

                  <Pressable
                    style={styles.groupCallPillBtn}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      } catch (e) {}
                      onClose();
                      onStartGroupCall(group);
                    }}
                  >
                    <Ionicons name="people" size={14} color="#000000" style={{ marginRight: 5 }} />
                    <Text style={styles.groupCallPillText}>Join Call</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.emptyWrap}>
                <Feather name="users" size={32} color="rgba(255, 255, 255, 0.25)" />
                <Text style={styles.emptyText}>No groups found</Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#11141c",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: "82%",
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerSub: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
  },
  tabSwitcher: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabSegment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tabSegmentActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  tabSegmentText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 12.5,
    fontWeight: "600",
  },
  tabSegmentTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  listScrollView: {
    maxHeight: 380,
  },
  listScrollContent: {
    paddingBottom: 16,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1c202a",
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
    marginRight: 10,
  },
  contactName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  contactSub: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12,
  },
  contactActions: {
    flexDirection: "row",
    gap: 8,
  },
  callCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  groupCallPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  groupCallPillText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 13,
    marginTop: 8,
  },
});
