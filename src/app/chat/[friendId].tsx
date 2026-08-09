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
  Modal,
  Appearance
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useChatSettings, wallpaperList } from "../../contexts/ChatSettingsContext";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  setDoc,
  limit,
} from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { db } from "../../lib/firebase"; 
import { useUser } from "../../contexts/UserContext"; 
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import UserProfileModal from "../../components/UserProfileModal";

export default function ChatRoom() {
  const { friendId: rawId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useUser();

  const { wallpaper, fontSize, theme: chatTheme } = useChatSettings();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [friendData, setFriendData] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  
  // FIXED: Now stores both URI for preview and Base64 for uploading
  const [pendingImage, setPendingImage] = useState<{uri: string, base64: string} | null>(null);

  const flatListRef = useRef<any>(null);

  let friendId = rawId as string;
  if (friendId?.includes("_") && user) {
    const ids = friendId.split("_");
    friendId = ids.find((id) => id !== user.uid) || friendId;
  }

  const chatId = user && friendId ? [user.uid, friendId].sort().join("_") : null;

  useEffect(() => {
    if (!friendId) return;
    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendData(snap.data());
    });
    return () => unsub();
  }, [friendId]);

  useEffect(() => {
    if (!chatId || !user) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"), limit(300));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach((docSnap) => msgs.push({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);

      msgs.forEach(async (msg) => {
        if (msg.senderId !== user.uid && !msg.isRead) {
          await updateDoc(doc(db, "chats", chatId, "messages", msg.id), { isRead: true }).catch(() => {});
        }
      });

      setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
    });
    return () => unsub();
  }, [chatId]);

  const sendMessage = async () => {
    if (!input.trim() || !chatId || !user) return;
    const messageText = input;
    setInput("");
    setReplyTo(null);

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: messageText,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        isRead: false,
        replyTo: replyTo ? { text: replyTo.text, senderId: replyTo.senderId } : null,
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: { text: messageText },
        lastTimestamp: serverTimestamp(),
      }).catch(async () => {
        await setDoc(doc(db, "chats", chatId), {
          participants: [user.uid, friendId],
          lastMessage: { text: messageText },
          lastTimestamp: serverTimestamp(),
        });
      });
    } catch {
      Alert.alert("Error", "Message failed");
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission required", "Allow access to your camera roll to send images.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,    
      aspect: [4, 5],         
      quality: 0.7,
      base64: true, // FIXED: Ask ImagePicker to give us the Base64 directly
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPendingImage({
        uri: result.assets[0].uri,
        base64: result.assets[0].base64 || ""
      });
    }
  };

  const uploadImage = async () => {
    if (!chatId || !user || !pendingImage) return;
    
    const base64Data = pendingImage.base64;
    setPendingImage(null); // Close modal immediately
    setUploading(true);

    try {
      const storage = getStorage();
      const filename = `chat_images/${chatId}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      // FIXED: Upload the raw base64 string
      await uploadString(storageRef, base64Data, 'base64', {
        contentType: 'image/jpeg',
      });

      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "", 
        imageUrl: downloadURL,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        isRead: false,
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: { text: "📷 Image" },
        lastTimestamp: serverTimestamp(),
      });
    } catch (error: any) {
      console.error("Upload Error:", error);
      Alert.alert("Upload Failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return "";
    const date = new Date(timestamp.seconds * 1000);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const renderItem = ({ item, index }: any) => {
    const isOwn = item.senderId === user?.uid;
    const prev = messages[index - 1];
    const showDate = !prev || formatDate(prev.timestamp) !== formatDate(item.timestamp);

    return (
      <View style={{ width: '100%' }}>
        {showDate && formatDate(item.timestamp) !== "" && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
          </View>
        )}

        <View style={[styles.row, isOwn ? styles.right : styles.left]}>
          <Pressable
            onLongPress={() => {
              Alert.alert("Options", "", [
                { text: "Reply", onPress: () => setReplyTo(item) },
                { text: "Delete", onPress: async () => {
                    await updateDoc(doc(db, "chats", chatId!, "messages", item.id), { deleted: true });
                }},
                { text: "Cancel", style: "cancel" },
              ]);
            }}
          >
            <View style={[
                styles.bubble,
                isOwn ? styles.bubbleOwn : styles.bubbleOther,
                { backgroundColor: isOwn ? (isDarkChat ? '#25d366' : '#a8e6cf') : (isDarkChat ? '#1c2329' : '#ffffff') },
              ]}>
              {item.replyTo && (
                <View style={styles.replyBox}>
                  <Text style={styles.replyText}>{item.replyTo.text || "📷 Image"}</Text>
                </View>
              )}

              {item.imageUrl && !item.deleted && (
                <Pressable onPress={() => setSelectedImage(item.imageUrl)}>
                  <Image source={{ uri: item.imageUrl }} style={styles.chatImage} resizeMode="cover" />
                </Pressable>
              )}

              {(item.text || item.deleted) ? (
                <Text
                  style={{
                    fontSize,
                    color: isDarkChat
                      ? '#fff'
                      : '#000',
                  }}
                >
                  {item.deleted ? "🚫 This message was deleted" : item.text}
                </Text>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.timeText}>
                  {item.timestamp?.seconds
                    ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
                    : ""}
                </Text>
                {isOwn && (
                  <Ionicons name="checkmark-done" size={15} color={item.isRead ? "#4fc3f7" : "#667781"} style={{ marginLeft: 4 }} />
                )}
              </View>
            </View>
          </Pressable>
        </View>
      </View>
    );
  };

  const backgroundUri =
    wallpaper === "default"
      ? "https://i.ibb.co/C0f9vH9/dark-wave-bg.png"
      : wallpaperList.find((w) => w.id === wallpaper)?.uri ||
        "https://i.ibb.co/C0f9vH9/dark-wave-bg.png";

  const isDarkChat =
    chatTheme === 'dark' ||
    (chatTheme === 'system' && Appearance.getColorScheme() === 'dark');

  return (
    <ImageBackground source={{ uri: backgroundUri }} style={[styles.container, { backgroundColor: isDarkChat ? '#0b141a' : '#f4f4f4' }]}> // fallback base color
      <StatusBar barStyle="light-content" backgroundColor="#0b141a" translucent={true} />
      
      {/* Removed SafeAreaView wrapper to give us manual control 
        over the top padding via styles.header 
      */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        
        <View style={styles.header}>
          <Pressable style={styles.circleBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="white" />
          </Pressable>
          <Pressable
            style={styles.userPill}
            onPress={() => {
              setSelectedProfileId(friendId);
              setShowProfileModal(true);
            }}
          >
            <Image source={{ uri: friendData?.photoURL || "https://i.pravatar.cc/150" }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>{friendData?.name || friendData?.username || "User"}</Text>
              <Text style={styles.userHandle} numberOfLines={1}>@{friendData?.username || "user"}</Text>
            </View>
          </Pressable>
          <Pressable style={styles.circleBtn}>
            <Ionicons name="call" size={20} color="white" />
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />

        {replyTo && (
          <View style={styles.replyPreviewBar}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#25d366", fontSize: 12, fontWeight: 'bold' }}>Replying to</Text>
              <Text style={{ color: "#ccc", fontSize: 13 }} numberOfLines={1}>{replyTo.text || "📷 Image"}</Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={24} color="#888" />
            </Pressable>
          </View>
        )}

        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <Pressable style={styles.cameraIcon} onPress={pickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="camera" size={20} color="white" />
              )}
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type your message..."
              placeholderTextColor="#888"
              style={styles.textInput}
              multiline
            />
          </View>
          <Pressable style={styles.sendButton} onPress={sendMessage} disabled={!input.trim()}>
            <Ionicons name="send" size={20} color="black" style={{ marginLeft: 2 }} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* FULL SCREEN MODAL FOR VIEWING SENT IMAGES */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeModalButton} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={30} color="white" />
          </Pressable>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.fullScreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* PREVIEW MODAL BEFORE SENDING AN IMAGE */}
      <Modal visible={!!pendingImage} transparent={true} animationType="slide">
        <View style={styles.pendingModalContainer}>
          <Pressable style={styles.closeModalButton} onPress={() => setPendingImage(null)}>
            <Ionicons name="close" size={30} color="white" />
          </Pressable>
          
          {pendingImage && (
            <Image source={{ uri: pendingImage.uri }} style={styles.fullScreenImage} resizeMode="contain" />
          )}

          <View style={styles.pendingControls}>
             <Pressable style={styles.pendingSendButton} onPress={uploadImage}>
                <Text style={styles.pendingSendText}>Send Image</Text>
                <Ionicons name="send" size={18} color="black" style={{ marginLeft: 8 }} />
             </Pressable>
          </View>
        </View>
      </Modal>

      <UserProfileModal
        userId={selectedProfileId || friendId}
        userData={selectedProfileId === friendId ? friendData : null}
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onStartChat={(id) => {
          setShowProfileModal(false);
          if (id !== friendId) {
            router.push(`/chat/${id}` as any);
          }
        }}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, // background handled dynamically
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 15, 
    // FIXED: Safely pushes the header below the Android status bar icons
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50, 
    paddingBottom: 10,
    backgroundColor: 'rgba(11, 20, 26, 0.5)', // Slight background to separate it from scrolling messages
  },
  circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1c2329', justifyContent: 'center', alignItems: 'center' },
  userPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c2329', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 30, flex: 0.85 },
  avatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10 },
  userName: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  userHandle: { color: '#aaa', fontSize: 11 },
  row: { marginVertical: 4, width: '100%' },
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  bubble: { maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#0f4f41', backgroundColor: '#000000' },
  bubbleOwn: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 2 },
  bubbleOther: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 2 },
  messageText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  chatImage: { width: 220, height: 280, borderRadius: 10, marginBottom: 5, alignSelf: 'center' },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 4 },
  timeText: { fontSize: 10, color: "#888" },
  dateSeparator: { alignSelf: "center", marginVertical: 15 },
  dateText: { color: "#888", fontSize: 12, fontWeight: '600' },
  replyPreviewBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#1c2329", marginHorizontal: 15, padding: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderLeftWidth: 4, borderLeftColor: '#25d366' },
  replyBox: { borderLeftWidth: 3, borderLeftColor: "#25d366", paddingLeft: 6, marginBottom: 6, backgroundColor: 'rgba(37, 211, 102, 0.1)', borderRadius: 4, paddingVertical: 4, paddingRight: 4 },
  replyText: { color: "#ccc", fontSize: 12 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 15, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 25 : 20 },
  inputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c2329', borderRadius: 25, paddingHorizontal: 6, paddingVertical: 6, minHeight: 50 },
  cameraIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2a333c', justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, color: 'white', paddingHorizontal: 12, fontSize: 15, maxHeight: 100 },
  sendButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeModalButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  fullScreenImage: { width: '100%', height: '80%' },
  
  pendingModalContainer: { flex: 1, backgroundColor: '#0e1218', justifyContent: 'center', alignItems: 'center' },
  pendingControls: { position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' },
  pendingSendButton: { flexDirection: 'row', backgroundColor: '#25d366', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30, alignItems: 'center', elevation: 5 },
  pendingSendText: { color: 'black', fontWeight: 'bold', fontSize: 16 }
});