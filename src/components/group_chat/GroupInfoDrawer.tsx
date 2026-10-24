import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Switch,
  Platform,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView as SafeAreaViewContext, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  limit,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useCall } from "../../contexts/CallContext";
import { DEFAULT_WALLPAPER_ASSET } from "../../contexts/ChatSettingsContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_GROUP_AVATAR = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=200";
const SCENIC_BANNER = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800";

interface GroupInfoDrawerProps {
  visible: boolean;
  onClose: () => void;
  groupId: string | null;
  currentUser: any;
  memberInfo?: { [key: string]: any };
  onOpenWallpaperTheme?: () => void;
  wallpaperSource?: any;
}

export default function GroupInfoDrawer({
  visible,
  onClose,
  groupId,
  currentUser,
  memberInfo = {},
  onOpenWallpaperTheme,
  wallpaperSource,
}: GroupInfoDrawerProps) {
  const insets = useSafeAreaInsets();
  const { startCall } = useCall();

  const [groupInfo, setGroupInfo] = useState<any>({});
  const [createdByUser, setCreatedByUser] = useState<any>(null);
  const [memberData, setMemberData] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);

  // Sub-screens
  const [editingGroupInfo, setEditingGroupInfo] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);

  // Edit fields (Image 4)
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [iconType, setIconType] = useState<"image" | "emoji">("image");
  const [savingDetails, setSavingDetails] = useState(false);

  // Settings & permissions (Image 5)
  const [editAccess, setEditAccess] = useState<"admins" | "all">("admins");
  const [addAccess, setAddAccess] = useState<"admins" | "all">("admins");
  const [sendAccess, setSendAccess] = useState<"admins" | "all">("all");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");

  // Add members state
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState<string[]>([]);

  const [tripData, setTripData] = useState<any>(null);
  const [isFavouriteGroup, setIsFavouriteGroup] = useState(false);

  // ═══════════════════════════════════════════════════════════════
  // 1. FETCH GROUP & MEMBERS
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!groupId || !visible) return;

    const groupDocRef = doc(db, "groupChats", groupId);
    const unsub = onSnapshot(groupDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGroupInfo(data);
        setEditName(data.name || "");
        setEditDescription(data.description || "");
        setEditIcon(data.iconURL || data.icon || DEFAULT_GROUP_AVATAR);
        setEditAccess(data.editAccess === "all" ? "all" : "admins");
        setAddAccess(data.inviteAccess === "all" ? "all" : "admins");
        setSendAccess(data.sendAccess === "admins" ? "admins" : "all");

        // Creator Profile
        if (data.createdBy) {
          try {
            const cDoc = await getDoc(doc(db, "users", data.createdBy));
            if (cDoc.exists()) setCreatedByUser(cDoc.data());
          } catch (e) {}
        }

        // Fetch Trip Data (for Trip Cover Image and details)
        const targetTripId = data.tripId || groupId;
        if (targetTripId) {
          try {
            const tDoc = await getDoc(doc(db, "trips", targetTripId));
            if (tDoc.exists()) setTripData({ id: tDoc.id, ...tDoc.data() });
          } catch (e) {}
        }

        // Member Profiles
        if (Array.isArray(data.members) && data.members.length > 0) {
          const dict: { [key: string]: any } = {};
          await Promise.all(
            data.members.map(async (mId: string) => {
              try {
                const uDoc = await getDoc(doc(db, "users", mId));
                if (uDoc.exists()) {
                  dict[mId] = { uid: mId, ...uDoc.data() };
                }
              } catch (e) {}
            })
          );
          setMemberData(dict);
        }

        setLoading(false);
      }
    });

    return () => unsub();
  }, [groupId, visible]);

  // Sync Favourite Group status with Firestore & AsyncStorage
  useEffect(() => {
    if (!groupId || !currentUser?.uid) return;

    AsyncStorage.getItem(`@bunkmates_favourite_chats_${currentUser.uid}`).then((cached) => {
      if (cached) {
        try {
          const list: string[] = JSON.parse(cached);
          setIsFavouriteGroup(list.includes(groupId));
        } catch (e) {}
      }
    });

    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const fList: string[] = d.favouriteChatIds || [];
        setIsFavouriteGroup(fList.includes(groupId));
      }
    });

    return () => unsub();
  }, [groupId, currentUser?.uid]);

  const handleToggleFavouriteGroup = async (val: boolean) => {
    if (!groupId || !currentUser?.uid) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    setIsFavouriteGroup(val);

    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      const cached = await AsyncStorage.getItem(`@bunkmates_favourite_chats_${currentUser.uid}`);
      let parsed: string[] = cached ? JSON.parse(cached) : [];

      if (val) {
        await updateDoc(userDocRef, {
          favouriteChatIds: arrayUnion(groupId),
        });
        if (!parsed.includes(groupId)) parsed.push(groupId);
        await AsyncStorage.setItem(
          `@bunkmates_favourite_chats_${currentUser.uid}`,
          JSON.stringify(parsed)
        );
      } else {
        await updateDoc(userDocRef, {
          favouriteChatIds: arrayRemove(groupId),
        });
        parsed = parsed.filter((id) => id !== groupId);
        await AsyncStorage.setItem(
          `@bunkmates_favourite_chats_${currentUser.uid}`,
          JSON.stringify(parsed)
        );
      }
    } catch (err) {
      console.error("Error toggling favourite group:", err);
    }
  };

  const isUserAdmin = useMemo(() => {
    return (
      groupInfo?.createdBy === currentUser?.uid ||
      (groupInfo?.admins || []).includes(currentUser?.uid)
    );
  }, [groupInfo, currentUser?.uid]);

  // ═══════════════════════════════════════════════════════════════
  // 2. GROUP ACTIONS (Update, Settings, Exit, Remove, Call)
  // ═══════════════════════════════════════════════════════════════

  // Save Edit Group Details (Image 4)
  const handleSaveGroupDetails = async () => {
    if (!groupId) return;
    setSavingDetails(true);
    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, {
        name: editName.trim() || groupInfo.name,
        description: editDescription.trim(),
        iconURL: editIcon || groupInfo.iconURL || DEFAULT_GROUP_AVATAR,
      });
      setEditingGroupInfo(false);
      Alert.alert("Success", "Group details updated successfully");
    } catch (e) {
      console.log("Error updating group details:", e);
      Alert.alert("Error", "Failed to update group details");
    } finally {
      setSavingDetails(false);
    }
  };

  // Pick Image for Group
  const handlePickGroupImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission required", "Allow gallery access to choose a group image.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        setEditIcon(res.assets[0].uri);
      }
    } catch (e) {
      console.log("Pick image error:", e);
    }
  };

  // Update Permissions (Image 5)
  const handleUpdatePermission = async (field: string, val: string) => {
    if (!groupId) return;
    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, { [field]: val });
    } catch (e) {
      console.log("Permission update error:", e);
    }
  };

  // Change Member Role (Image 5)
  const handleChangeMemberRole = async (targetUid: string, currentRole: string) => {
    if (!groupId || !isUserAdmin) return;
    if (targetUid === groupInfo?.createdBy) {
      Alert.alert("Owner", "Group owner role cannot be altered.");
      return;
    }

    const nextRole = currentRole === "Admin" ? "Member" : "Admin";
    Alert.alert("Change Member Role", `Make this member ${nextRole}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const groupRef = doc(db, "groupChats", groupId);
            if (nextRole === "Admin") {
              await updateDoc(groupRef, { admins: arrayUnion(targetUid) });
            } else {
              await updateDoc(groupRef, { admins: arrayRemove(targetUid) });
            }
          } catch (e) {
            console.log("Role update error:", e);
          }
        },
      },
    ]);
  };

  // Call Member via WebRTC
  const handleCallMember = (member: any) => {
    if (!member?.uid) return;
    startCall({
      receiverId: member.uid,
      receiverName: member.name || member.displayName || member.username || "Traveler",
      receiverAvatar: member.photoURL || DEFAULT_GROUP_AVATAR,
      receiverHandle: member.username || "user",
      callType: "audio",
    });
  };

  // Remove Member
  const handleRemoveMember = (uid: string, name: string) => {
    if (!groupId || !isUserAdmin) return;
    if (uid === groupInfo?.createdBy) {
      Alert.alert("Cannot Remove", "The group creator cannot be removed.");
      return;
    }

    Alert.alert("Remove Member", `Remove ${name} from this group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const groupRef = doc(db, "groupChats", groupId);
            await updateDoc(groupRef, {
              members: arrayRemove(uid),
              admins: arrayRemove(uid),
            });
          } catch (e) {
            console.log("Remove member error:", e);
          }
        },
      },
    ]);
  };

  // Exit Group
  const handleExitGroup = () => {
    if (!currentUser || !groupId) return;

    Alert.alert("Exit Group", "Are you sure you want to exit this group?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Exit",
        style: "destructive",
        onPress: async () => {
          try {
            const groupRef = doc(db, "groupChats", groupId);
            await updateDoc(groupRef, {
              members: arrayRemove(currentUser.uid),
              admins: arrayRemove(currentUser.uid),
            });
            onClose();
          } catch (e) {
            console.log("Exit group error:", e);
          }
        },
      },
    ]);
  };

  // Search users to add
  useEffect(() => {
    if (!addMembersOpen || searchUserQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const q = query(collection(db, "users"), limit(25));
        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const inGroup = groupInfo?.members?.includes(d.id);
          const matches =
            data.username?.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
            data.name?.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
            data.displayName?.toLowerCase().includes(searchUserQuery.toLowerCase());
          if (!inGroup && matches) {
            list.push({ uid: d.id, ...data });
          }
        });
        setSearchResults(list);
      } catch (e) {
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchUserQuery, addMembersOpen, groupInfo?.members]);

  const handleAddSelectedUsers = async () => {
    if (!groupId || selectedUsersToAdd.length === 0) return;
    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, {
        members: arrayUnion(...selectedUsersToAdd),
      });
      setSelectedUsersToAdd([]);
      setSearchUserQuery("");
      setAddMembersOpen(false);
      Alert.alert("Success", "Members added to group");
    } catch (e) {
      Alert.alert("Error", "Failed to add members");
    }
  };

  const membersList = useMemo(() => {
    const list = (groupInfo?.members || []).map((uid: string) => {
      return (
        memberData[uid] ||
        memberInfo[uid] || {
          uid,
          name: uid === currentUser?.uid ? "You" : "Traveler",
          username: "user",
          photoURL: DEFAULT_GROUP_AVATAR,
        }
      );
    });
    return list;
  }, [groupInfo?.members, memberData, memberInfo, currentUser?.uid]);

  const filteredMembersList = useMemo(() => {
    if (!memberSearchTerm.trim()) return membersList;
    const q = memberSearchTerm.toLowerCase();
    return membersList.filter(
      (m: any) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.username && m.username.toLowerCase().includes(q))
    );
  }, [membersList, memberSearchTerm]);

  const tripCoverImage =
    tripData?.coverImage ||
    tripData?.image ||
    tripData?.photoURL ||
    groupInfo?.tripCover ||
    groupInfo?.coverImage ||
    groupInfo?.iconURL ||
    SCENIC_BANNER;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={s.modalRoot}>
        {/* ── 1. BACKGROUND CHAT WALLPAPER WITH REAL BLUR (Guarantees perfect blur on Android & iOS!) ── */}
        <ExpoImage
          source={wallpaperSource || DEFAULT_WALLPAPER_ASSET}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          blurRadius={Platform.OS === "android" ? 35 : 25}
        />

        {/* ── 2. FULL BACKGROUND FROSTED BLUR ── */}
        <BlurView
          intensity={Platform.OS === "ios" ? 85 : 100}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* ── 3. ADAPTIVE DARK-GLASS SCRIM ── */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(10, 14, 22, 0.82)" },
          ]}
          pointerEvents="none"
        />

        <SafeAreaViewContext style={s.safeContainer} edges={["top", "left", "right"]}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

          {/* ═══════════════════════════════════════════════════════════
             MAIN GROUP INFO SCREEN
             ═══════════════════════════════════════════════════════════ */}
          {/* Header: [ ← ] Group Info   [ ⭐ Favourite ] */}
          <View style={s.topHeaderRow}>
            <Pressable onPress={onClose} style={s.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </Pressable>
            <Text style={s.topHeaderTitle}>Group Info</Text>

            {/* Favorite Star Icon in Header */}
            <Pressable
              onPress={() => handleToggleFavouriteGroup(!isFavouriteGroup)}
              style={s.headerStarBtn}
              hitSlop={10}
            >
              <Ionicons
                name={isFavouriteGroup ? "star" : "star-outline"}
                size={22}
                color={isFavouriteGroup ? "#f59e0b" : "#ffffff"}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.scrollBody, { paddingBottom: insets.bottom + 40 }]}
          >
            {/* Big Circular Group Avatar */}
            <View style={s.avatarCenterContainer}>
              <View style={s.avatarGlowContainer}>
                <ExpoImage
                  source={{ uri: groupInfo?.iconURL || DEFAULT_GROUP_AVATAR }}
                  style={s.bigGroupAvatar}
                  contentFit="cover"
                />
              </View>
              <Text style={s.groupNameHeading}>{groupInfo?.name || "Bunk1"}</Text>
            </View>

            {/* Group Description Card */}
            <View style={s.descCard}>
              <Text style={s.descText}>
                {groupInfo?.description || "Group for Trip from Jaipur to Dehradun"}
              </Text>
              <Text style={s.createdNotice}>
                Created by <Text style={{ fontWeight: "700", color: "#ffffff" }}>{createdByUser?.name || "Mohit Sharma"}</Text>
              </Text>
            </View>

            {/* ── TRIP TIMELINE CARD WITH BLURRED TRIP COVER PHOTO (User Request) ── */}
            <View style={s.timelineBannerCard}>
              <ExpoImage
                source={{ uri: tripCoverImage }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                blurRadius={Platform.OS === "android" ? 16 : 12}
              />
              {/* Glass Gradient Scrim on blurred photo */}
              <LinearGradient
                colors={["rgba(10, 15, 26, 0.40)", "rgba(10, 15, 26, 0.85)"]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.timelineOverlay}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={s.timelineGroupName} numberOfLines={1}>{groupInfo?.name || tripData?.name || "Bunk1"}</Text>
                  <View style={s.tripTag}>
                    <Text style={s.tripTagText}>Trip</Text>
                  </View>
                </View>
                <Text style={s.timelineRoute} numberOfLines={1}>
                  📍 {tripData?.destination || tripData?.route || "Jaipur → Dehradun"}
                </Text>

                <View style={s.timelineProgressRow}>
                  <Text style={s.timelineProgressLabel}>
                    Timeline Progress: {tripData?.progressDays || "6"} / {tripData?.totalDays || "10"} days
                  </Text>
                  <Text style={s.timelinePercentText}>{tripData?.progressPercent || 60}%</Text>
                </View>
                {/* Progress Bar */}
                <View style={s.progressBarTrack}>
                  <View style={[s.progressBarFill, { width: `${tripData?.progressPercent || 60}%` }]} />
                </View>
              </View>
            </View>

            {/* ── MARK AS FAVOURITE GROUP CARD (User Request) ── */}
            <View style={s.favouriteCardRow}>
              <View style={[s.favouriteIconCircle, isFavouriteGroup && { backgroundColor: "rgba(245, 158, 11, 0.18)" }]}>
                <Ionicons
                  name={isFavouriteGroup ? "star" : "star-outline"}
                  size={20}
                  color={isFavouriteGroup ? "#f59e0b" : "rgba(255, 255, 255, 0.7)"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.favouriteTitle}>Mark as Favourite Group</Text>
                <Text style={s.favouriteSubtitle}>Pin to Favourites tab for quick access</Text>
              </View>
              <Switch
                value={isFavouriteGroup}
                onValueChange={handleToggleFavouriteGroup}
                trackColor={{ false: "#2a2d36", true: "#f59e0b" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Action Buttons: Edit Group Info | Group Settings */}
            <Pressable
              onPress={() => setEditingGroupInfo(true)}
              style={s.actionRowButton}
              hitSlop={8}
            >
              <View style={s.actionRowLeft}>
                <Feather name="edit-3" size={18} color="#ffffff" style={{ marginRight: 12 }} />
                <Text style={s.actionRowText}>Edit Group Info</Text>
              </View>
              <Feather name="chevron-right" size={18} color="rgba(255, 255, 255, 0.4)" />
            </Pressable>

            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={s.actionRowButton}
              hitSlop={8}
            >
              <View style={s.actionRowLeft}>
                <Ionicons name="settings-outline" size={20} color="#ffffff" style={{ marginRight: 12 }} />
                <Text style={s.actionRowText}>Group Settings</Text>
              </View>
              <Feather name="chevron-right" size={18} color="rgba(255, 255, 255, 0.4)" />
            </Pressable>

            {onOpenWallpaperTheme && (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenWallpaperTheme();
                }}
                style={s.actionRowButton}
                hitSlop={8}
              >
                <View style={s.actionRowLeft}>
                  <Ionicons name="color-palette-outline" size={20} color="#ffffff" style={{ marginRight: 12 }} />
                  <Text style={s.actionRowText}>Customize Wallpaper & Theme</Text>
                </View>
                <Feather name="chevron-right" size={18} color="rgba(255, 255, 255, 0.4)" />
              </Pressable>
            )}

            {/* Members Section (Images 2 & 3) */}
            <View style={s.membersSection}>
              <Text style={s.membersSectionHeading}>{membersList.length} Members</Text>

              {/* Add Members Button */}
              <Pressable
                onPress={() => setAddMembersOpen(true)}
                style={s.addMemberRow}
                hitSlop={8}
              >
                <View style={s.addMemberLeft}>
                  <View style={s.addMemberCircle}>
                    <Feather name="plus" size={18} color="#000000" />
                  </View>
                  <Text style={s.addMemberText}>Add Members</Text>
                </View>
                <Feather name="chevron-right" size={18} color="rgba(255, 255, 255, 0.4)" />
              </Pressable>

            {/* Members List */}
            {membersList.map((member: any) => {
              const isCreator = member.uid === groupInfo?.createdBy;
              const isAdmin = isCreator || (groupInfo?.admins || []).includes(member.uid);
              const isCurrentUser = member.uid === currentUser?.uid;

              return (
                <View key={member.uid} style={s.memberItemRow}>
                  <ExpoImage
                    source={{ uri: member.photoURL || DEFAULT_GROUP_AVATAR }}
                    style={s.memberAvatar}
                    contentFit="cover"
                  />

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={s.memberName}>
                        {member.name || member.displayName || "Traveler"}
                        {isCurrentUser && " (You)"}
                      </Text>
                      {isAdmin && (
                        <View style={s.adminBadge}>
                          <Text style={s.adminBadgeText}>
                            {isCreator ? "Owner" : "Admin"}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.memberHandle}>@{member.username || "user"}</Text>
                  </View>

                  {/* Actions: Call & Remove */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {!isCurrentUser && (
                      <Pressable
                        onPress={() => handleCallMember(member)}
                        style={s.memberCallBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="call-outline" size={17} color="#ffffff" />
                      </Pressable>
                    )}

                    {isUserAdmin && !isCurrentUser && !isCreator && (
                      <Pressable
                        onPress={() => handleRemoveMember(member.uid, member.name || "user")}
                        style={s.memberRemoveBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="remove-circle-outline" size={22} color="#ff5252" />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Exit Group Button (Images 2 & 3) */}
          <Pressable onPress={handleExitGroup} style={s.exitGroupBtn} hitSlop={8}>
            <Ionicons name="exit-outline" size={20} color="#ff5252" style={{ marginRight: 8 }} />
            <Text style={s.exitGroupText}>Exit Group</Text>
          </Pressable>
        </ScrollView>

        {/* ═══════════════════════════════════════════════════════════
           IMAGE 4: EDIT GROUP DETAILS MODAL
           ═══════════════════════════════════════════════════════════ */}
        <Modal
          visible={editingGroupInfo}
          animationType="fade"
          transparent
          onRequestClose={() => setEditingGroupInfo(false)}
        >
          <View style={s.modalOverlay}>
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingGroupInfo(false)} />

            <View style={[s.editModalSheet, { paddingBottom: insets.bottom + 20 }]}>
              <Text style={s.editModalTitle}>Edit Group Details</Text>

              {/* Group Name Input */}
              <Text style={s.inputFieldLabel}>Group Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={s.textInputField}
                placeholder="Group Name"
                placeholderTextColor="#666"
              />

              {/* Group Avatar Preview */}
              <View style={s.editAvatarRow}>
                <ExpoImage
                  source={{ uri: editIcon || DEFAULT_GROUP_AVATAR }}
                  style={s.editAvatarThumb}
                  contentFit="cover"
                />
              </View>

              {/* Icon Type Dropdown */}
              <Text style={s.inputFieldLabel}>Icon Type</Text>
              <View style={s.dropdownSelectBox}>
                <Text style={s.dropdownSelectText}>Image URL</Text>
                <Ionicons name="chevron-down" size={16} color="rgba(255, 255, 255, 0.6)" />
              </View>

              {/* Image URL or Uploaded Image */}
              <Text style={s.inputFieldLabel}>Image URL or Uploaded Image</Text>
              <TextInput
                value={editIcon}
                onChangeText={setEditIcon}
                style={s.textInputField}
                placeholder="Image URL"
                placeholderTextColor="#666"
              />

              {/* Select Image Button */}
              <Pressable onPress={handlePickGroupImage} style={s.selectImageBtn} hitSlop={8}>
                <Feather name="folder" size={16} color="#fbbf24" style={{ marginRight: 8 }} />
                <Text style={s.selectImageText}>Select Image</Text>
              </Pressable>
              <Text style={s.imageSizeHint}>Only images under 250KB allowed.</Text>

              {/* Group Description */}
              <Text style={[s.inputFieldLabel, { marginTop: 14 }]}>Group Description</Text>
              <TextInput
                value={editDescription}
                onChangeText={setEditDescription}
                style={[s.textInputField, { height: 72, textAlignVertical: "top" }]}
                placeholder="Group Description"
                placeholderTextColor="#666"
                multiline
              />

              {/* Cancel & Save Changes Buttons */}
              <View style={s.editModalButtonsRow}>
                <Pressable
                  onPress={() => setEditingGroupInfo(false)}
                  style={s.editCancelBtn}
                  hitSlop={8}
                >
                  <Text style={s.editCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveGroupDetails}
                  style={s.editSaveBtn}
                  disabled={savingDetails}
                  hitSlop={8}
                >
                  {savingDetails ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={s.editSaveText}>Save Changes</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════
           IMAGE 5: GROUP SETTINGS SCREEN
           ═══════════════════════════════════════════════════════════ */}
        <Modal
          visible={settingsOpen}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setSettingsOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: "#0b0f14" }}>
            <SafeAreaViewContext style={{ flex: 1 }} edges={["top", "left", "right"]}>
              <View style={s.topHeaderRow}>
                <Pressable onPress={() => setSettingsOpen(false)} style={s.backBtn} hitSlop={10}>
                  <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </Pressable>
                <Text style={s.topHeaderTitle}>Group Settings</Text>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[s.scrollBody, { paddingBottom: insets.bottom + 40 }]}
              >
                {/* Permissions Section */}
                <Text style={s.settingsSectionHeading}>Permissions</Text>

                {/* 1. Who can edit group info? */}
                <Text style={s.permissionQuestion}>Who can edit group info?</Text>
                <View style={s.permissionToggleRow}>
                  <Pressable
                    onPress={() => {
                      setEditAccess("admins");
                      handleUpdatePermission("editAccess", "admins");
                    }}
                    style={[s.permToggleBtn, editAccess === "admins" && s.permToggleBtnActive]}
                  >
                    <Text style={[s.permToggleText, editAccess === "admins" && s.permToggleTextActive]}>
                      Admins Only
                    </Text>
                    {editAccess === "admins" && (
                      <Feather name="check" size={18} color="#38bdf8" />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setEditAccess("all");
                      handleUpdatePermission("editAccess", "all");
                    }}
                    style={[s.permToggleBtn, editAccess === "all" && s.permToggleBtnActive]}
                  >
                    <Text style={[s.permToggleText, editAccess === "all" && s.permToggleTextActive]}>
                      All Members
                    </Text>
                    {editAccess === "all" && (
                      <Feather name="check" size={18} color="#38bdf8" />
                    )}
                  </Pressable>
                </View>

                {/* 2. Who can add members? */}
                <Text style={s.permissionQuestion}>Who can add members?</Text>
                <View style={s.permissionToggleRow}>
                  <Pressable
                    onPress={() => {
                      setAddAccess("admins");
                      handleUpdatePermission("inviteAccess", "admins");
                    }}
                    style={[s.permToggleBtn, addAccess === "admins" && s.permToggleBtnActive]}
                  >
                    <Text style={[s.permToggleText, addAccess === "admins" && s.permToggleTextActive]}>
                      Admins Only
                    </Text>
                    {addAccess === "admins" && (
                      <Feather name="check" size={18} color="#38bdf8" />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setAddAccess("all");
                      handleUpdatePermission("inviteAccess", "all");
                    }}
                    style={[s.permToggleBtn, addAccess === "all" && s.permToggleBtnActive]}
                  >
                    <Text style={[s.permToggleText, addAccess === "all" && s.permToggleTextActive]}>
                      All Members
                    </Text>
                    {addAccess === "all" && (
                      <Feather name="check" size={18} color="#38bdf8" />
                    )}
                  </Pressable>
                </View>

                {/* 3. Who can send messages? */}
                <Text style={s.permissionQuestion}>Who can send messages?</Text>
                <View style={s.permissionToggleRow}>
                  <Pressable
                    onPress={() => {
                      setSendAccess("admins");
                      handleUpdatePermission("sendAccess", "admins");
                    }}
                    style={[s.permToggleBtn, sendAccess === "admins" && s.permToggleBtnActive]}
                  >
                    <Text style={[s.permToggleText, sendAccess === "admins" && s.permToggleTextActive]}>
                      Admins Only
                    </Text>
                    {sendAccess === "admins" && (
                      <Feather name="check" size={18} color="#38bdf8" />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setSendAccess("all");
                      handleUpdatePermission("sendAccess", "all");
                    }}
                    style={[s.permToggleBtn, sendAccess === "all" && s.permToggleBtnActive]}
                  >
                    <Text style={[s.permToggleText, sendAccess === "all" && s.permToggleTextActive]}>
                      All Members
                    </Text>
                    {sendAccess === "all" && (
                      <Feather name="check" size={18} color="#38bdf8" />
                    )}
                  </Pressable>
                </View>

                {/* Members & Admins Section */}
                <View style={s.membersAdminsHeaderRow}>
                  <Text style={s.settingsSectionHeading}>Members & Admins</Text>
                </View>

                {/* Search Bar */}
                <View style={s.memberSearchBox}>
                  <Feather name="search" size={16} color="#7f8c9b" style={{ marginRight: 8 }} />
                  <TextInput
                    placeholder="Search"
                    placeholderTextColor="#7f8c9b"
                    value={memberSearchTerm}
                    onChangeText={setMemberSearchTerm}
                    style={s.memberSearchInput}
                  />
                </View>

                {/* Members & Roles List */}
                {filteredMembersList.map((member: any) => {
                  const isCreator = member.uid === groupInfo?.createdBy;
                  const isAdmin = isCreator || (groupInfo?.admins || []).includes(member.uid);
                  const roleLabel = isCreator ? "Owner" : isAdmin ? "Admin" : "Member";

                  return (
                    <View key={member.uid} style={s.memberRoleRow}>
                      <ExpoImage
                        source={{ uri: member.photoURL || DEFAULT_GROUP_AVATAR }}
                        style={s.memberAvatar}
                        contentFit="cover"
                      />

                      <View style={{ flex: 1 }}>
                        <Text style={s.memberName}>{member.name || member.displayName || "Traveler"}</Text>
                        <Text style={s.memberHandle}>@{member.username || "user"}</Text>
                      </View>

                      {/* Role Dropdown Pill */}
                      {isCreator ? (
                        <View style={s.ownerRoleBadge}>
                          <Text style={s.ownerRoleText}>Owner</Text>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => handleChangeMemberRole(member.uid, roleLabel)}
                          style={s.roleDropdownPill}
                          disabled={!isUserAdmin}
                          hitSlop={8}
                        >
                          <Text style={s.roleDropdownText}>{roleLabel}</Text>
                          {isUserAdmin && (
                            <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.7)" />
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </SafeAreaViewContext>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════
           ADD MEMBERS MODAL
           ═══════════════════════════════════════════════════════════ */}
        <Modal
          visible={addMembersOpen}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setAddMembersOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: "#0b0f14" }}>
            <SafeAreaViewContext style={{ flex: 1 }} edges={["top", "left", "right"]}>
              <View style={s.topHeaderRow}>
                <Pressable onPress={() => setAddMembersOpen(false)} style={s.backBtn} hitSlop={10}>
                  <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </Pressable>
                <Text style={s.topHeaderTitle}>Add Members</Text>
              </View>

              <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                <View style={s.memberSearchBox}>
                  <Feather name="search" size={16} color="#7f8c9b" style={{ marginRight: 8 }} />
                  <TextInput
                    placeholder="Search by username or name..."
                    placeholderTextColor="#7f8c9b"
                    value={searchUserQuery}
                    onChangeText={setSearchUserQuery}
                    style={s.memberSearchInput}
                  />
                </View>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {searchLoading && <ActivityIndicator size="small" color="#fff" style={{ marginVertical: 10 }} />}

                {searchResults.map((usr) => {
                  const isSelected = selectedUsersToAdd.includes(usr.uid);
                  return (
                    <Pressable
                      key={usr.uid}
                      onPress={() =>
                        setSelectedUsersToAdd((prev) =>
                          isSelected ? prev.filter((id) => id !== usr.uid) : [...prev, usr.uid]
                        )
                      }
                      style={s.memberItemRow}
                    >
                      <ExpoImage
                        source={{ uri: usr.photoURL || DEFAULT_GROUP_AVATAR }}
                        style={s.memberAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.memberName}>{usr.name || usr.displayName || usr.username}</Text>
                        <Text style={s.memberHandle}>@{usr.username || "user"}</Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "add-circle-outline"}
                        size={24}
                        color={isSelected ? "#00e676" : "rgba(255,255,255,0.4)"}
                      />
                    </Pressable>
                  );
                })}

                {selectedUsersToAdd.length > 0 && (
                  <Pressable onPress={handleAddSelectedUsers} style={s.confirmAddBtn}>
                    <Text style={s.confirmAddText}>Add {selectedUsersToAdd.length} Member(s)</Text>
                  </Pressable>
                )}
              </ScrollView>
            </SafeAreaViewContext>
          </View>
        </Modal>
      </SafeAreaViewContext>
    </View>
  </Modal>
  );
}

/* ──────── STYLES (Matching Images 2, 3, 4, 5) ──────── */

const s = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  safeContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    gap: 14,
  },
  backBtn: {
    padding: 4,
  },
  topHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
  },
  headerStarBtn: {
    padding: 8,
    marginLeft: "auto",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Avatar & Group Name Hero (Image 2)
  avatarCenterContainer: {
    alignItems: "center",
    marginBottom: 18,
  },
  avatarGlowContainer: {
    borderRadius: 56,
    padding: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  bigGroupAvatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "#222",
  },
  groupNameHeading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 14,
    letterSpacing: -0.3,
  },

  // Description Card (Image 2)
  descCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  descText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 14,
    lineHeight: 21,
  },
  createdNotice: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12.5,
    marginTop: 10,
  },

  // Trip Timeline Banner Card (Images 2 & 3 - User Request with blurred trip photo)
  timelineBannerCard: {
    height: 144,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    position: "relative",
  },
  timelineOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  timelineGroupName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  tripTag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  tripTagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timelineRoute: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 2,
  },
  timelineProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timelineProgressLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
  },
  timelinePercentText: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    marginTop: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 2.5,
  },

  // Favourite Card (User Request)
  favouriteCardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  favouriteIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  favouriteTitle: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "700",
  },
  favouriteSubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11.5,
    marginTop: 2,
  },

  // Action Buttons (Images 2 & 3)
  actionRowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  actionRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionRowText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Members Section (Images 2 & 3)
  membersSection: {
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 18,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  membersSectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.6)",
    marginBottom: 14,
  },
  addMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  addMemberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addMemberCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  addMemberText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  memberItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#222",
  },
  memberName: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "700",
  },
  memberHandle: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12,
    marginTop: 2,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  adminBadgeText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontWeight: "700",
  },
  memberCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  memberRemoveBtn: {
    padding: 4,
  },

  // Exit Group (Images 2 & 3)
  exitGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.2)",
  },
  exitGroupText: {
    color: "#ff5252",
    fontSize: 15,
    fontWeight: "700",
  },

  // ═══════════════════════════════════════════════════════════
  // EDIT GROUP DETAILS MODAL (Image 4)
  // ═══════════════════════════════════════════════════════════
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  editModalSheet: {
    backgroundColor: "#13151b",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 18,
  },
  inputFieldLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  textInputField: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#ffffff",
    fontSize: 14.5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 14,
  },
  editAvatarRow: {
    alignItems: "center",
    marginVertical: 10,
  },
  editAvatarThumb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  dropdownSelectBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 14,
  },
  dropdownSelectText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  selectImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  selectImageText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  imageSizeHint: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    marginBottom: 10,
  },
  editModalButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  editCancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  editCancelText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  editSaveBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: "#ffffff",
  },
  editSaveText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP SETTINGS SCREEN (Image 5)
  // ═══════════════════════════════════════════════════════════
  settingsSectionHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 16,
  },
  permissionQuestion: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.85)",
    marginBottom: 10,
  },
  permissionToggleRow: {
    flexDirection: "column",
    gap: 8,
    marginBottom: 20,
    width: "100%",
  },
  permToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  permToggleBtnActive: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  permToggleText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 14.5,
    fontWeight: "600",
  },
  permToggleTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },

  membersAdminsHeaderRow: {
    marginTop: 10,
  },
  memberSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  memberSearchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
  },
  memberRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  ownerRoleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  ownerRoleText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  roleDropdownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  roleDropdownText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  // Confirm Add Button
  confirmAddBtn: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  confirmAddText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
});
