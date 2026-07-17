import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useUser } from "../../../contexts/UserContext";
import { useGroupChat } from "../../../hooks/useGroupChat";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { MaterialCommunityIcons, Ionicons, Feather, AntDesign } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { SafeAreaView as SafeAreaViewContext } from "react-native-safe-area-context";
import GroupInfoDrawer from "../../../components/group_chat/GroupInfoDrawer";


export default function GroupChatroom() {
  const { groupId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useUser();
  
  const { messages, loading: messagesLoading } = useGroupChat(groupId as string || null);
  
  const [groupData, setGroupData] = useState<any>(null);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string } | null>(null);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [memberDetailsMap, setMemberDetailsMap] = useState<{ [key: string]: any }>({});
  
  const flatListRef = useRef<any>(null);

  // Fetch group data
  useEffect(() => {
    if (!groupId) return;
    const unsub = onSnapshot(doc(db, "groupChats", groupId as string), (snap) => {
      if (snap.exists()) {
        setGroupData(snap.data());
      }
    });
    return () => unsub();
  }, [groupId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() && !pendingImage) return;
    if (!groupId || !user) return;

    const messageText = input;
    setInput("");
    setReplyTo(null);

    try {
      let imageUrl = null;

      // Upload image if present
      if (pendingImage) {
        setUploading(true);
        const storage = getStorage();
        const storageRef = ref(storage, `group-messages/${groupId}/${Date.now()}`);
        const uploadTask = await uploadString(storageRef, pendingImage.base64, "base64", {
          contentType: "image/jpeg",
        });
        imageUrl = await getDownloadURL(uploadTask.ref);
        setPendingImage(null);
      }

      // Add message to Firestore
      await addDoc(collection(db, "groupChats", groupId as string, "messages"), {
        text: messageText || "",
        imageUrl: imageUrl || null,
        senderId: user.uid,
        senderName: user.displayName || "Anonymous",
        senderAvatar: user.photoURL || null,
        timestamp: serverTimestamp(),
        replyTo: replyTo ? { text: replyTo.text, senderId: replyTo.senderId, senderName: replyTo.senderName } : null,
      });

      setUploading(false);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission required", "Allow access to your camera roll to send images.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPendingImage({
          uri: result.assets[0].uri,
          base64: result.assets[0].base64 || "",
        });
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const renderMessage = ({ item }: any) => {
    const isOwnMessage = item.senderId === user?.uid;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <Image
            source={{ uri: item.senderAvatar || "https://via.placeholder.com/40" }}
            style={styles.avatar}
          />
        )}
        
        <Pressable
          onLongPress={() => {
            Alert.alert("Options", "Reply", [
              {
                text: "Reply",
                onPress: () => setReplyTo(item),
              },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
          style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}
        >
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}

          {item.replyTo && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyText} numberOfLines={1}>
                {item.replyTo.senderName}: {item.replyTo.text}
              </Text>
            </View>
          )}

          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.messageImage}
            />
          )}

          {item.text && <Text style={styles.messageText}>{item.text}</Text>}

          <Text style={styles.timestamp}>
            {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }) : ""}
          </Text>
        </Pressable>
      </View>
    );
  };

  if (messagesLoading || !groupData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#b36a22" />
      </View>
    );
  }

  return (
    <SafeAreaViewContext style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e0e" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
            <Pressable
              onPress={() => setShowGroupInfo(true)}
            >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {groupData?.name || "Group Chat"}
          </Text>
          <Text style={styles.memberCount}>
            {groupData?.members?.length || 1} members
          </Text>
        </View>
        <Image
          source={{ uri: groupData?.iconURL || "https://via.placeholder.com/50" }}
          style={styles.headerIcon}
        />
        </Pressable>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Reply Preview */}
        {replyTo && (
          <View style={styles.replyingTo}>
            <View style={styles.replyingContent}>
              <Text style={styles.replyingLabel}>Replying to {replyTo.senderName}</Text>
              <Text style={styles.replyingText} numberOfLines={1}>
                {replyTo.text}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Feather name="x" size={20} color="#888" />
            </Pressable>
          </View>
        )}

        {/* Image Preview */}
        {pendingImage && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: pendingImage.uri }} style={styles.previewImage} />
            <Pressable
              style={styles.removeImageBtn}
              onPress={() => setPendingImage(null)}
            >
              <AntDesign name="close" size={20} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <Pressable onPress={pickImage} disabled={uploading}>
              <MaterialCommunityIcons
                name="image-plus"
                size={24}
                color={uploading ? "#666" : "#b36a22"}
              />
            </Pressable>

            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#888"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              editable={!uploading}
            />

            <Pressable
              onPress={sendMessage}
              disabled={uploading || (!input.trim() && !pendingImage)}
              style={[
                styles.sendBtn,
                (uploading || (!input.trim() && !pendingImage)) && styles.sendBtnDisabled,
              ]}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </Pressable>

            <GroupInfoDrawer
  visible={showGroupInfo}
  onClose={() => setShowGroupInfo(false)}
  groupId={groupId}
  currentUser={user}
  memberInfo={memberDetailsMap}
/>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaViewContext>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e0e",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0e0e0e",
  },
  header: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    gap: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  memberCount: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageContainer: {
    flexDirection: "row",
    marginVertical: 6,
    alignItems: "flex-end",
    gap: 8,
  },
  ownMessage: {
    justifyContent: "flex-end",
  },
  otherMessage: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 12,
  },
  ownBubble: {
    backgroundColor: "#b36a22",
  },
  otherBubble: {
    backgroundColor: "#2a2a2a",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#b36a22",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: "#fff",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 4,
    textAlign: "right",
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: "#b36a22",
    paddingLeft: 8,
    marginBottom: 6,
    backgroundColor: "rgba(179, 106, 34, 0.1)",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  replyText: {
    fontSize: 12,
    color: "#ccc",
    fontStyle: "italic",
  },
  inputContainer: {
    backgroundColor: "#1a1a1a",
    borderTopWidth: 1,
    borderTopColor: "#333",
    padding: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: "#b36a22",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#666",
    opacity: 0.5,
  },
  replyingTo: {
    flexDirection: "row",
    backgroundColor: "#2a2a2a",
    padding: 10,
    marginHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyingContent: {
    flex: 1,
    marginRight: 10,
  },
  replyingLabel: {
    fontSize: 12,
    color: "#b36a22",
    fontWeight: "600",
  },
  replyingText: {
    fontSize: 12,
    color: "#ccc",
    marginTop: 2,
  },
  imagePreview: {
    marginHorizontal: 12,
    marginBottom: 10,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
});
