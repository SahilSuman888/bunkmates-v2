import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  Modal,
  Image,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { MaterialCommunityIcons, AntDesign, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { TouchableOpacity } from "react-native";

interface GroupInfoDrawerProps {
  visible: boolean;
  onClose: () => void;
  groupId: string | null;
  currentUser: any;
  memberInfo: { [key: string]: any };
}

export default function GroupInfoDrawer({
  visible,
  onClose,
  groupId,
  currentUser,
  memberInfo = {},
}: GroupInfoDrawerProps) {
  const [groupInfo, setGroupInfo] = useState<any>({});
  const [memberData, setMemberData] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [editingGroupInfo, setEditingGroupInfo] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupIcon, setGroupIcon] = useState("");
  const [iconType, setIconType] = useState<"image" | "emoji">("image");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [selectedMemberToRemove, setSelectedMemberToRemove] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [roleMenuOpenFor, setRoleMenuOpenFor] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState(null);
const [drawerVisible, setDrawerVisible] = useState(false);

  // Fetch group data
  useEffect(() => {
    if (!groupId || !visible) return;

    const unsubscribe = onSnapshot(doc(db, "groupChats", groupId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGroupInfo(data);
        setGroupName(data.name || "");
        setGroupDescription(data.description || "");
        setGroupIcon(data.iconURL || data.emoji || "");
        setLoading(false);

        // Fetch member details
        fetchMemberDetails(data.members || []);
      }
    });

    return () => unsubscribe();
  }, [groupId, visible]);

  // Fetch member details from Firestore
  const fetchMemberDetails = async (memberIds: string[]) => {
    const details: { [key: string]: any } = {};

    await Promise.all(
      memberIds.map(async (memberId) => {
        try {
          const userDoc = await getDoc(doc(db, "users", memberId));
          if (userDoc.exists()) {
            details[memberId] = userDoc.data();
          }
        } catch (error) {
          console.error("Error fetching member:", error);
        }
      })
    );

    setMemberData(details);
  };

  // Search users
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    const fetchUsers = async () => {
      setSearchLoading(true);
      try {
        const q = query(collection(db, "users"), limit(50));
        const snapshot = await getDocs(q);
        const results: any[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const uid = doc.id;
          const isAlreadyInGroup = groupInfo?.members?.includes(uid);
          const matchesSearch =
            data.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            data.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            data.displayName?.toLowerCase().includes(searchTerm.toLowerCase());

          if (!isAlreadyInGroup && matchesSearch) {
            results.push({ uid, ...data });
          }
        });

        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearchLoading(false);
      }
    };

    fetchUsers();
  }, [searchTerm, groupInfo?.members]);

  const canEditGroupInfo =
    groupInfo?.editAccess === "all" ||
    groupInfo?.createdBy === currentUser?.uid ||
    groupInfo?.admins?.includes(currentUser?.uid);

  const canAddMembers =
    groupInfo?.inviteAccess === "all" ||
    groupInfo?.createdBy === currentUser?.uid ||
    groupInfo?.admins?.includes(currentUser?.uid);

  const isCurrentUserAdmin =
    groupInfo?.createdBy === currentUser?.uid ||
    groupInfo?.admins?.includes(currentUser?.uid);

  const handleUpdateGroupInfo = async () => {
    if (!groupId) return;

    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, {
        name: groupName.trim() || groupInfo.name,
        description: groupDescription.trim(),
        iconURL: groupIcon,
      });

      setEditingGroupInfo(false);
      Alert.alert("Success", "Group info updated");
    } catch (error) {
      console.error("Error updating group:", error);
      Alert.alert("Error", "Failed to update group info");
    }
  };

  const handleExitGroup = async () => {
    if (!currentUser || !groupId) return;

    Alert.alert(
      "Exit Group",
      "Are you sure you want to exit this group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit",
          style: "destructive",
          onPress: async () => {
            try {
              const groupRef = doc(db, "groupChats", groupId);
              const groupSnap = await getDoc(groupRef);

              if (!groupSnap.exists()) return;

              const groupData = groupSnap.data();

              if (groupData.isSystem) {
                Alert.alert("Cannot Exit", "You cannot exit a system group.");
                return;
              }

              await updateDoc(groupRef, {
                members: arrayRemove(currentUser.uid),
              });

              onClose();
            } catch (error) {
              console.error("Error exiting group:", error);
              Alert.alert("Error", "Failed to exit group");
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = async (uid: string) => {
    if (!groupId) return;

    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, {
        members: arrayRemove(uid),
      });

      Alert.alert("Success", "Member removed from group");
      setConfirmDialogOpen(false);
    } catch (error) {
      console.error("Error removing member:", error);
      Alert.alert("Error", "Failed to remove member");
    }
  };

  const handleBatchAddUsers = async () => {
    if (!groupId || selectedUsers.length === 0) return;

    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, {
        members: arrayUnion(...selectedUsers),
      });

      setSelectedUsers([]);
      setSearchTerm("");
      setSearchResults([]);
      setAddMembersOpen(false);
      Alert.alert("Success", "Users added to group");
    } catch (error) {
      console.error("Error adding users:", error);
      Alert.alert("Error", "Failed to add users");
    }
  };

  const getInviteLink = () => {
    if (!groupId) return "";
    // Use a web invite path that your web app understands. Adjust domain as needed.
    const base = global?.APP_BASE_URL || "https://bunk-mates.vercel.app";
    return `${base}/group-invite/${groupId}`;
  };

  const handleCopyInvite = async () => {
    const link = getInviteLink();
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert("Copied", "Invite link copied to clipboard");
    } catch (e) {
      console.error("Clipboard error", e);
      Alert.alert("Error", "Could not copy link");
    }
  };

  const handleShareInvite = async () => {
    const link = getInviteLink();
    if (!link) return;
    try {
      await Share.share({ message: `Join my group: ${link}`, url: link, title: "Group invite" });
    } catch (e) {
      console.error("Share error", e);
      Alert.alert("Error", "Could not open share dialog");
    }
  };

  const handlePermissionChange = async (field: string, value: string) => {
    if (!groupId) return;

    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, {
        [field]: value,
      });
    } catch (error) {
      console.error("Error updating permission:", error);
      Alert.alert("Error", "Failed to update permission");
    }
  };

  const handleMakeAdmin = async (uid: string) => {
    if (!groupId) return;
    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, {
        admins: arrayUnion(uid),
      });
      setRoleMenuOpenFor(null);
    } catch (error) {
      console.error("Error making admin:", error);
      Alert.alert("Error", "Failed to make admin");
    }
  };

  const openRoleDrawer = (uid: string) => {
    setSelectedUser(uid);
    setDrawerVisible(true);
  };

  const handleRemoveAdmin = async (uid: string) => {
    if (!groupId) return;
    try {
      const groupRef = doc(db, "groupChats", groupId);
      await updateDoc(groupRef, {
        admins: arrayRemove(uid),
      });
      setRoleMenuOpenFor(null);
    } catch (error) {
      console.error("Error removing admin:", error);
      Alert.alert("Error", "Failed to remove admin");
    }
  };

  const handleTransferOwnership = async (uid: string) => {
    if (!groupId) return;
    try {
      const previousOwner = groupInfo?.createdBy;
      const groupRef = doc(db, "groupChats", groupId);
      const updates: any = { createdBy: uid };
      // make sure previous owner remains admin
      if (previousOwner) {
        updates.admins = arrayUnion(previousOwner);
      }
      await updateDoc(groupRef, updates);
      setRoleMenuOpenFor(null);
    } catch (error) {
      console.error("Error transferring ownership:", error);
      Alert.alert("Error", "Failed to transfer ownership");
    }
  };

  const handleSetMemberRole = async (uid: string, role: "member" | "admin" | "owner") => {
    if (!groupId) return;
    try {
      if (role === "admin") {
        await handleMakeAdmin(uid);
      } else if (role === "member") {
        await handleRemoveAdmin(uid);
      } else if (role === "owner") {
        await handleTransferOwnership(uid);
      }
      setRoleMenuOpenFor(null);
    } catch (error) {
      console.error("Error setting member role:", error);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#b36a22" />
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={onClose}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </Pressable>
              <Text style={styles.headerTitle}>Group Info</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Main Content */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Group Icon & Name */}
              <View style={styles.groupHeader}>
                <Pressable
                  onPress={() => {
                    const uri = groupInfo.iconURL || groupInfo.emoji || "https://via.placeholder.com/100";
                    setPreviewUri(uri);
                    setImagePreviewOpen(true);
                  }}
                >
                  <Image
                    source={{
                      uri: groupInfo.iconURL || groupInfo.emoji || "https://via.placeholder.com/100",
                    }}
                    style={styles.groupIcon}
                  />
                </Pressable>
                <Text style={styles.groupNameText}>{groupInfo.name || "Group"}</Text>

                {groupInfo.description && (
                  <Text style={styles.descriptionText}>{groupInfo.description}</Text>
                )}

                {groupInfo.createdBy && (
                  <View style={styles.createdByBox}>
                    <Text style={styles.createdByText}>
                      Created by{" "}
                      {memberData[groupInfo.createdBy]?.displayName ||
                        memberData[groupInfo.createdBy]?.name ||
                        memberInfo[groupInfo.createdBy]?.displayName ||
                        memberInfo[groupInfo.createdBy]?.name ||
                        "Unknown"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons - Large and Full Width */}
              <View style={styles.actionButtonsSection}>
                {canEditGroupInfo && (
                  <Pressable
                    style={styles.largeActionButton}
                    onPress={() => {
                      setGroupName(groupInfo.name || "");
                      setGroupDescription(groupInfo.description || "");
                      setGroupIcon(groupInfo.iconURL || "");
                      setEditingGroupInfo(true);
                    }}
                  >
                    <MaterialCommunityIcons name="pencil" size={24} color="#b36a22" />
                    <Text style={styles.largeActionButtonText}>EDIT GROUP INFO</Text>
                  </Pressable>
                )}

                {isCurrentUserAdmin && (
                  <Pressable
                    style={styles.largeActionButton}
                    onPress={() => setSettingsOpen(true)}
                  >
                    <MaterialCommunityIcons name="cog" size={24} color="#b36a22" />
                    <Text style={styles.largeActionButtonText}>GROUP SETTINGS</Text>
                  </Pressable>
                )}
              </View>

              {/* Members Section */}
              <View style={styles.membersSection}>
                <View style={styles.membersSectionHeader}>
                  <Text style={styles.membersSectionTitle}>
                    {groupInfo.members?.length || 0} Members
                  </Text>
                  {canAddMembers && (
                    <Pressable
                      onPress={() => setAddMembersOpen(true)}
                      style={styles.addMembersButton}
                    >
                      <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                      <Text style={styles.addMembersButtonText}>ADD MEMBERS</Text>
                    </Pressable>
                  )}
                </View>

                {/* Members List */}
                <View style={styles.membersList}>
                  {(groupInfo.members || [])
                    .sort((a: string, b: string) => {
                      const isCreatorA = a === groupInfo?.createdBy;
                      const isCreatorB = b === groupInfo?.createdBy;
                      if (isCreatorA) return -1;
                      if (isCreatorB) return 1;
                      return 0;
                    })
                    .map((memberUid: string) => {
                      const member = memberData[memberUid] || memberInfo[memberUid];
                      const isOwner = memberUid === groupInfo?.createdBy;
                      const isAdmin =
                        Array.isArray(groupInfo?.admins) &&
                        groupInfo.admins.includes(memberUid);
                      const isCurrentUser = memberUid === currentUser?.uid;

                      return (
                        <View key={memberUid} style={styles.memberItem}>
                          <Image
                            source={{
                              uri: member?.photoURL || "https://via.placeholder.com/40",
                            }}
                            style={styles.memberAvatar}
                          />

                          <View style={styles.memberInfo}>
                            <View style={styles.memberNameRow}>
                              <Text style={styles.memberName}>
                                {member?.displayName || member?.name || memberUid.slice(0, 6)}
                                {isCurrentUser && (
                                  <Text style={styles.youBadge}> (You)</Text>
                                )}
                              </Text>
                              {(isOwner || isAdmin) && (
                                <Pressable
                                  onPress={() => setRoleMenuOpenFor(memberUid)}
                                  style={[
                                    styles.badge,
                                    isOwner ? styles.adminBadge : styles.moderatorBadge,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.badgeText,
                                      isOwner
                                        ? styles.adminBadgeText
                                        : styles.moderatorBadgeText,
                                    ]}
                                  >
                                    {isOwner ? "Admin" : "Admin"}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                            <Text style={styles.memberUsername}>
                              @{member?.username || memberUid.slice(0, 6)}
                            </Text>
                          </View>

                          <View style={styles.memberActions}>
                            {member?.phoneNumber && (
                              <Pressable style={styles.callButton}>
                                <Ionicons name="call" size={20} color="#b36a22" />
                              </Pressable>
                            )}

                            {isCurrentUserAdmin &&
                              !isOwner &&
                              !isAdmin &&
                              memberUid !== currentUser?.uid && (
                                <Pressable
                                  onPress={() => {
                                    setSelectedMemberToRemove(memberUid);
                                    setConfirmDialogOpen(true);
                                  }}
                                  style={styles.removeButton}
                                >
                                  <MaterialCommunityIcons
                                    name="close-circle"
                                    size={24}
                                    color="#ff6767"
                                  />
                                </Pressable>
                              )}
                          </View>
                        </View>
                      );
                    })}
                </View>
              </View>

              {/* Exit Group Button */}
              <Pressable style={styles.exitButton} onPress={handleExitGroup}>
                <MaterialCommunityIcons name="logout" size={24} color="#ff6767" />
                <Text style={styles.exitButtonText}>EXIT GROUP</Text>
              </Pressable>

              <View style={{ height: 40 }} />
            </ScrollView>

            {/* Edit Group Modal */}
            <Modal
              visible={editingGroupInfo}
              animationType="slide"
              onRequestClose={() => setEditingGroupInfo(false)}
            >
              <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                  <Pressable onPress={() => setEditingGroupInfo(false)}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </Pressable>
                  <Text style={styles.headerTitle}>Edit Group Info</Text>
                  <View style={{ width: 24 }} />
                </View>

                <ScrollView style={styles.modalContent}>
                  <Text style={styles.label}>Group Name</Text>
                  <TextInput
                    style={styles.input}
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholderTextColor="#666"
                  />

                  <Text style={styles.label}>Icon Type</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                    <Pressable
                      onPress={() => setIconType("image")}
                      style={[
                        styles.permissionButton,
                        iconType === "image" && styles.permissionButtonActive,
                        { flex: 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.permissionButtonText,
                          iconType === "image" && styles.permissionButtonTextActive,
                        ]}
                      >
                        Image URL
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setIconType("emoji")}
                      style={[
                        styles.permissionButton,
                        iconType === "emoji" && styles.permissionButtonActive,
                        { flex: 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.permissionButtonText,
                          iconType === "emoji" && styles.permissionButtonTextActive,
                        ]}
                      >
                        Emoji
                      </Text>
                    </Pressable>
                  </View>

                  {iconType === "image" ? (
                    <>
                      <Text style={styles.label}>Image URL or Uploaded Image</Text>
                      <TextInput
                        style={styles.input}
                        value={groupIcon}
                        onChangeText={setGroupIcon}
                        placeholderTextColor="#666"
                      />
                      <Pressable
                        style={[styles.addMembersButton, { marginBottom: 12 }]}
                        onPress={async () => {
                          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (!permission.granted) return Alert.alert('Permission required');
                          try {
                            const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7 });
                            if (res.canceled || !res.assets || res.assets.length === 0) return;
                            const uri = res.assets[0].uri;
                            const info = await FileSystem.getInfoAsync(uri, { size: true });
                            const maxSize = 250 * 1024;
                            if (info.size && info.size > maxSize) {
                              Alert.alert('File size too large! Please select an image under 250KB.');
                              return;
                            }
                            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                            const mime = 'image/jpeg';
                            const dataUri = `data:${mime};base64,${base64}`;
                            setGroupIcon(dataUri);
                            setIconType('image');
                          } catch (e) {
                            console.error('image select error', e);
                            Alert.alert('Error', 'Failed to pick image');
                          }
                        }}
                      >
                        <MaterialCommunityIcons name="folder-image" size={18} color="#fff" />
                        <Text style={styles.addMembersButtonText}> Select Image</Text>
                      </Pressable>
                      <Text style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>
                        Only images under 250KB allowed.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>Emoji</Text>
                      <TextInput
                        style={styles.input}
                        value={groupIcon}
                        onChangeText={setGroupIcon}
                        placeholderTextColor="#666"
                      />
                    </>
                  )}

                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 100 }]}
                    value={groupDescription}
                    onChangeText={setGroupDescription}
                    placeholderTextColor="#666"
                    multiline
                  />

                  <View style={styles.buttonRow}>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => setEditingGroupInfo(false)}
                    >
                      <Text style={styles.cancelButtonText}>CANCEL</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.saveButton, { backgroundColor: "#fff" }]}
                      onPress={handleUpdateGroupInfo}
                    >
                      <Text style={[styles.saveButtonText, { color: "#000" }]}>SAVE CHANGES</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </SafeAreaView>
            </Modal>
            {/* Role Drawer (bottom) */}
            <Modal visible={drawerVisible} transparent animationType="slide" onRequestClose={() => setDrawerVisible(false)}>
              <TouchableOpacity style={styles.overlay} onPress={() => setDrawerVisible(false)} />
              <View style={styles.drawer}>
                <Text style={styles.drawerTitle}>Manage User</Text>
                <Text style={{ marginBottom: 12, color: "#333" }}>
                  {selectedUser ? (memberData[selectedUser]?.displayName || memberInfo[selectedUser]?.displayName || selectedUser) : ""}
                </Text>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    if (selectedUser) handleSetMemberRole(selectedUser, "admin");
                  }}
                >
                  <Text style={styles.optionText}>Make Admin</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    if (selectedUser) handleSetMemberRole(selectedUser, "member");
                  }}
                >
                  <Text style={styles.optionText}>Remove Admin</Text>
                </TouchableOpacity>

                {groupInfo?.createdBy === currentUser?.uid && (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => {
                      if (selectedUser) handleSetMemberRole(selectedUser, "owner");
                    }}
                  >
                    <Text style={[styles.optionText, { color: "#b36a22" }]}>Make Owner</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.option, { borderBottomWidth: 0 }]} onPress={() => setDrawerVisible(false)}>
                  <Text style={[styles.optionText, { color: "#888" }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Modal>

            {/* Image Preview Modal */}
            <Modal
              visible={imagePreviewOpen}
              animationType="fade"
              transparent={false}
              onRequestClose={() => setImagePreviewOpen(false)}
            >
              <SafeAreaView style={[styles.container, { backgroundColor: "#000" }]}>
                <Pressable
                  style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
                  onPress={() => setImagePreviewOpen(false)}
                >
                  {previewUri ? (
                    <Image
                      source={{ uri: previewUri }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <ActivityIndicator size="large" color="#b36a22" />
                  )}
                </Pressable>

                <View style={styles.previewBottom}>
                  <Text style={[styles.groupNameText, { fontSize: 18 }]}> {groupInfo.name}</Text>
                  <View style={styles.previewButtons}>
                    <Pressable
                      style={styles.previewButton}
                      onPress={() => Alert.alert("Message", "Open chat with group")}
                    >
                      <Text style={styles.previewButtonText}>Message</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.previewButton, { backgroundColor: "#1a1a1a" }]}
                      onPress={() => Alert.alert("Profile Info", "Open group profile")}
                    >
                      <Text style={[styles.previewButtonText, { color: "#fff" }]}>Profile Info</Text>
                    </Pressable>
                  </View>
                </View>
              </SafeAreaView>
            </Modal>

            {/* Role Menu Modal */}
            <Modal
              visible={!!roleMenuOpenFor}
              transparent
              animationType="fade"
              onRequestClose={() => setRoleMenuOpenFor(null)}
            >
              <View style={styles.dialogOverlay}>
                <View style={styles.dialogBox}>
                  <Text style={styles.dialogTitle}>Manage Role</Text>
                  <Text style={styles.dialogMessage}>
                    {roleMenuOpenFor
                      ? `Manage role for ${
                          (memberData[roleMenuOpenFor]?.displayName || memberInfo[roleMenuOpenFor]?.displayName || roleMenuOpenFor)
                        }`
                      : ""}
                  </Text>
                  <View style={{ marginBottom: 12 }}>
                    {roleMenuOpenFor && (
                      (() => {
                        const targetUid = roleMenuOpenFor as string;
                        const targetIsAdmin = Array.isArray(groupInfo?.admins) && groupInfo.admins.includes(targetUid);
                        const targetIsOwner = groupInfo?.createdBy === targetUid;
                        const canManage = isCurrentUserAdmin || groupInfo?.createdBy === currentUser?.uid;

                        return (
                          <>
                            {canManage && !targetIsAdmin && !targetIsOwner && (
                              <Pressable
                                style={[styles.permissionButton, { marginBottom: 8 }]}
                                onPress={() => handleMakeAdmin(targetUid)}
                              >
                                <Text style={styles.permissionButtonText}>Make Admin</Text>
                              </Pressable>
                            )}

                            {canManage && targetIsAdmin && !targetIsOwner && (
                              <Pressable
                                style={[styles.permissionButton, { marginBottom: 8 }]}
                                onPress={() => handleRemoveAdmin(targetUid)}
                              >
                                <Text style={styles.permissionButtonText}>Remove Admin</Text>
                              </Pressable>
                            )}

                            {groupInfo?.createdBy === currentUser?.uid && !targetIsOwner && (
                              <Pressable
                                style={[styles.permissionButton, { backgroundColor: "#b36a22" }]}
                                onPress={() => handleTransferOwnership(targetUid)}
                              >
                                <Text style={[styles.permissionButtonText, styles.permissionButtonTextActive]}>Make Owner</Text>
                              </Pressable>
                            )}
                          </>
                        );
                      })()
                    )}
                  </View>

                  <View style={styles.dialogActions}>
                    <Pressable
                      style={styles.dialogCancel}
                      onPress={() => setRoleMenuOpenFor(null)}
                    >
                      <Text style={styles.dialogCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
            {/* Settings Modal */}
            <Modal
              visible={settingsOpen}
              animationType="slide"
              onRequestClose={() => setSettingsOpen(false)}
            >
              <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                  <Pressable onPress={() => setSettingsOpen(false)}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </Pressable>
                  <Text style={styles.headerTitle}>Group Settings</Text>
                  <View style={{ width: 24 }} />
                </View>

                <ScrollView style={styles.modalContent}>
                  <Text style={styles.settingTitle}>Permissions</Text>

                  <View style={styles.permissionGroup}>
                    <Text style={styles.permissionLabel}>Who can edit group info?</Text>
                    <View style={styles.permissionButtons}>
                      {["admin", "all"].map((role) => (
                        <Pressable
                          key={role}
                          style={[
                            styles.permissionButton,
                            groupInfo?.editAccess === role &&
                              styles.permissionButtonActive,
                          ]}
                          onPress={() => handlePermissionChange("editAccess", role)}
                        >
                          <Text
                            style={[
                              styles.permissionButtonText,
                              groupInfo?.editAccess === role &&
                                styles.permissionButtonTextActive,
                            ]}
                          >
                            {role === "admin" ? "Admins Only" : "All Members"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.permissionGroup}>
                    <Text style={styles.permissionLabel}>Who can add members?</Text>
                    <View style={styles.permissionButtons}>
                      {["admin", "all"].map((role) => (
                        <Pressable
                          key={role}
                          style={[
                            styles.permissionButton,
                            groupInfo?.inviteAccess === role &&
                              styles.permissionButtonActive,
                          ]}
                          onPress={() => handlePermissionChange("inviteAccess", role)}
                        >
                          <Text
                            style={[
                              styles.permissionButtonText,
                              groupInfo?.inviteAccess === role &&
                                styles.permissionButtonTextActive,
                            ]}
                          >
                            {role === "admin" ? "Admins Only" : "All Members"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.permissionGroup}>
                    <Text style={styles.permissionLabel}>Who can send messages?</Text>
                    <View style={styles.permissionButtons}>
                      {[("admin" as const), ("all" as const)].map((role) => (
                        <Pressable
                          key={role}
                          style={[
                            styles.permissionButton,
                            groupInfo?.sendAccess === role && styles.permissionButtonActive,
                          ]}
                          onPress={() => handlePermissionChange("sendAccess", role)}
                        >
                          <Text
                            style={[
                              styles.permissionButtonText,
                              groupInfo?.sendAccess === role && styles.permissionButtonTextActive,
                            ]}
                          >
                            {role === "admin" ? "Admins Only" : "All Members"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <Text style={[styles.settingTitle, { marginTop: 8 }]}>Members & Admins</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search"
                    placeholderTextColor="#666"
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                  />

                  <View style={{ marginBottom: 12 }} />

                  {(groupInfo.members || [])
                    .filter((memberUid: string) => {
                      if (!searchTerm || searchTerm.trim() === "") return true;
                      const m = memberData[memberUid] || memberInfo[memberUid] || {};
                      const q = searchTerm.toLowerCase();
                      return (
                        (m.displayName || "").toLowerCase().includes(q) ||
                        (m.username || "").toLowerCase().includes(q) ||
                        memberUid.toLowerCase().includes(q)
                      );
                    })
                    .map((memberUid: string) => {
                    const member = memberData[memberUid] || memberInfo[memberUid];
                    const isOwner = memberUid === groupInfo?.createdBy;
                    const isAdmin = Array.isArray(groupInfo?.admins) && groupInfo.admins.includes(memberUid);

                    return (
                      <View key={memberUid} style={[styles.memberItem, { marginBottom: 8 }]}>
                        <Image
                          source={{ uri: member?.photoURL || "https://via.placeholder.com/40" }}
                          style={styles.memberAvatar}
                        />
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{member?.displayName || memberUid.slice(0, 6)}</Text>
                          <Text style={styles.memberUsername}>@{member?.username || memberUid.slice(0, 6)}</Text>
                        </View>
                        <View style={[
  styles.badge,
  isOwner ? styles.adminBadge :
  isAdmin ? styles.adminBadge :
  styles.moderatorBadge
]}> 
  <Text style={[
    styles.badgeText,
    isOwner ? styles.adminBadgeText :
    styles.moderatorBadgeText
  ]}>
    {isOwner ? "Owner" : isAdmin ? "Admin" : "Member"}
  </Text>
</View>

                        <Pressable
                          onPress={() => openRoleDrawer(memberUid)}
                          style={{ paddingHorizontal: 8 }}
                        >
                          <MaterialCommunityIcons name="chevron-down" size={18} color="#fff" />
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </SafeAreaView>
            </Modal>

            {/* Add Members Modal (flatlist with header to avoid nested VirtualizedList inside ScrollView) */}
            <Modal
              visible={addMembersOpen}
              animationType="slide"
              onRequestClose={() => setAddMembersOpen(false)}
            >
              <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                  <Pressable onPress={() => setAddMembersOpen(false)}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </Pressable>
                  <Text style={styles.headerTitle}>Add Members</Text>
                  <View style={{ width: 24 }} />
                </View>

                {searchLoading ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#b36a22" />
                  </View>
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.uid}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.userItem}
                        onPress={() => {
                          setSelectedUsers((prev) =>
                            prev.includes(item.uid)
                              ? prev.filter((id) => id !== item.uid)
                              : [...prev, item.uid]
                          );
                        }}
                      >
                        <Image
                          source={{ uri: item.photoURL || "https://via.placeholder.com/40" }}
                          style={styles.userAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userName}>{item.username || item.displayName || item.email}</Text>
                          <Text style={styles.userEmail}>{item.email}</Text>
                        </View>
                        <MaterialCommunityIcons
                          name={selectedUsers.includes(item.uid) ? "checkbox-marked" : "checkbox-blank-outline"}
                          size={24}
                          color={selectedUsers.includes(item.uid) ? "#b36a22" : "#666"}
                        />
                      </Pressable>
                    )}
                    contentContainerStyle={{ padding: 16 }}
                    ListHeaderComponent={() => (
                      <View style={{ alignItems: "center", marginBottom: 16 }}>
                        <View style={{ width: 72, height: 72, borderRadius: 36, overflow: "hidden", marginBottom: 12 }}>
                          <Image source={{ uri: groupInfo.iconURL || "https://via.placeholder.com/100" }} style={{ width: 72, height: 72 }} />
                        </View>
                        <Text style={{ color: "#fff", fontWeight: "700", marginBottom: 8 }}>{groupInfo.name}</Text>
                        <Text style={{ color: "#ccc", fontSize: 12, marginBottom: 12 }}>{groupInfo.description}</Text>

                        <View style={{ backgroundColor: "#111", padding: 12, borderRadius: 12, width: "100%", alignItems: "center" }}>
                          <Text style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>Or add members directly</Text>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Text style={{ color: "#fff", flex: 1 }}>{getInviteLink()}</Text>
                            <Pressable onPress={handleCopyInvite} style={{ marginLeft: 8 }}>
                              <MaterialCommunityIcons name="content-copy" size={20} color="#fff" />
                            </Pressable>
                          </View>

                          <Pressable onPress={handleShareInvite} style={{ marginTop: 12, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
                            <Text style={{ color: "#000", fontWeight: "700" }}>SHARE INVITE LINK</Text>
                          </Pressable>
                        </View>

                        <View style={{ marginTop: 16, backgroundColor: "#111", padding: 12, borderRadius: 12 }}>
                          <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(getInviteLink())}&size=200x200` }} style={{ width: 200, height: 200, backgroundColor: "#fff" }} />
                        </View>

                        <Text style={[styles.label, { marginLeft: 0, marginTop: 16 }]}>Add members directly</Text>
                        <TextInput style={styles.searchInput} placeholder="Search by name, email or username..." placeholderTextColor="#666" value={searchTerm} onChangeText={setSearchTerm} />
                      </View>
                    )}
                    ListFooterComponent={() => (
                      selectedUsers.length > 0 ? (
                        <View style={styles.selectedUsersTag}>
                          <Text style={styles.selectedUsersText}>{selectedUsers.length} users selected</Text>
                          <Pressable style={styles.addSelectedButton} onPress={handleBatchAddUsers}>
                            <Text style={styles.addSelectedText}>Add</Text>
                          </Pressable>
                        </View>
                      ) : null
                    )}
                  />
                )}
              </SafeAreaView>
            </Modal>

            {/* Confirm Remove Dialog */}
            <Modal
              visible={confirmDialogOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setConfirmDialogOpen(false)}
            >
              <View style={styles.dialogOverlay}>
                <View style={styles.dialogBox}>
                  <Text style={styles.dialogTitle}>Remove Member</Text>
                  <Text style={styles.dialogMessage}>
                    Are you sure you want to remove this member from the group?
                  </Text>
                  <View style={styles.dialogActions}>
                    <Pressable
                      style={styles.dialogCancel}
                      onPress={() => setConfirmDialogOpen(false)}
                    >
                      <Text style={styles.dialogCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={styles.dialogConfirm}
                      onPress={() => {
                        if (selectedMemberToRemove) {
                          handleRemoveMember(selectedMemberToRemove);
                        }
                      }}
                    >
                      <Text style={styles.dialogConfirmText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e0e",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  groupHeader: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  groupIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  groupNameText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  descriptionText: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 20,
  },
  createdByBox: {
    marginTop: 12,
  },
  createdByText: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
  actionButtonsSection: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  largeActionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  largeActionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  membersSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  membersSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  membersSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  addMembersButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  addMembersButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  membersList: {
    gap: 8,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
   marginBottom: 4,
  },
  memberName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  youBadge: {
    fontStyle: "italic",
    color: "#888",
    fontWeight: "normal",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adminBadge: {
    backgroundColor: "#b36a2244",
  },
  moderatorBadge: {
    backgroundColor: "#88888844",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  adminBadgeText: {
    color: "#b36a22",
  },
  moderatorBadgeText: {
    color: "#ccc",
  },
  memberUsername: {
    color: "#888",
    fontSize: 12,
  },
  memberActions: {
    flexDirection: "row",
    gap: 8,
  },
  callButton: {
    backgroundColor: "rgba(179, 106, 34, 0.18)",
    borderRadius: 10,
    padding: 10,
  },
  removeButton: {
    backgroundColor: "rgba(255, 103, 103, 0.2)",
    borderRadius: 12,
    padding: 8,
  },
  exitButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff000010",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginHorizontal: 16,
  },
  exitButtonText: {
    color: "#ff6767",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 12,
    color: "#fff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#b36a22",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  permissionGroup: {
    marginBottom: 24,
  },
  permissionLabel: {
    color: "#ccc",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  permissionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  permissionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
  },
  permissionButtonActive: {
    backgroundColor: "#b36a22",
    borderColor: "#b36a22",
  },
  permissionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  permissionButtonTextActive: {
    color: "#000",
  },
  searchInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 12,
    color: "#fff",
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  userEmail: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  selectedUsersTag: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    margin: 16,
    borderRadius: 12,
    padding: 12,
  },
  selectedUsersText: {
    color: "#fff",
    fontWeight: "600",
  },
  addSelectedButton: {
    backgroundColor: "#b36a22",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addSelectedText: {
    color: "#fff",
    fontWeight: "600",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 300,
  },
  dialogTitle: {
    color: "#ff6767",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  dialogMessage: {
    color: "#ccc",
    fontSize: 14,
    marginBottom: 24,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12,
  },
  dialogCancel: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  dialogCancelText: {
    color: "#fff",
    fontWeight: "600",
  },
  dialogConfirm: {
    flex: 1,
    backgroundColor: "#ff6767",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  dialogConfirmText: {
    color: "#fff",
    fontWeight: "600",
  },
  previewImage: {
    width: "100%",
    height: "75%",
  },
  previewBottom: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  previewButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  previewButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  previewButtonText: {
    color: "#000",
    fontWeight: "700",
  },
  iconPreviewSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 12,
  },
  overlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.5)",
},

drawer: {
  position: "absolute",
  bottom: 0,
  width: "100%",
  backgroundColor: "#fff",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  padding: 20,
},

drawerTitle: {
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 15,
},

option: {
  paddingVertical: 15,
  borderBottomWidth: 1,
  borderBottomColor: "#eee",
},

optionText: {
  fontSize: 16,
},
});
