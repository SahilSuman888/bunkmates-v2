import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ImageBackground,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  FlatList,
  Platform,
  StatusBar,
  Switch,
  Linking,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "./ui/AppBlurView";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { useRouter } from "expo-router";
import { db } from "../lib/firebase";
import { useUser } from "../contexts/UserContext";
import { useCall } from "../contexts/CallContext";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { wallpaperList, DEFAULT_WALLPAPER_ASSET } from "../contexts/ChatSettingsContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import PrivatePinModal from "./chat/PrivatePinModal";
import PrivateLockSuccessModal from "./chat/PrivateLockSuccessModal";
import WallpaperThemePreviewModal from "./chat/WallpaperThemePreviewModal";
import NicknameEditModal from "./chat/NicknameEditModal";

const DEFAULT_GROUP_AVATAR = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=200";
const DARK_WAVE_WALLPAPER = require("../../assets/images/dark_wave_bg.jpg");

export default function UserProfileModal({
  userId,
  userData: initialUserData,
  visible,
  onClose,
  onStartChat,
  onWallpaperChange,
}: {
  userId?: string | null;
  userData?: any;
  visible: boolean;
  onClose: () => void;
  onStartChat?: (uid: string) => void;
  onWallpaperChange?: (wallpaper: string | null, bubbleColor?: string, dimLevel?: number) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useUser();
  const { startCall } = useCall();
  const { themeColors, accentColor, onAccentTextColor, isDark, scaleFont } = useThemeToggle();
  const modalAccent = accentColor || "#00e6b0";
  const onModalAccentText = onAccentTextColor || "#000000";

  const targetUid = userId || initialUserData?.uid || initialUserData?.id;

  // Real profile data state
  const [userProfile, setUserProfile] = useState<any>(initialUserData || null);
  const [loading, setLoading] = useState(false);

  // Nickname State
  const [nickname, setNickname] = useState<string>("");
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [tempNickname, setTempNickname] = useState("");

  // Mutual Data States (Real Data)
  const [mutualFriends, setMutualFriends] = useState<any[]>([]);
  const [mutualModalOpen, setMutualModalOpen] = useState(false);
  const [commonGroups, setCommonGroups] = useState<any[]>([]);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [commonTrips, setCommonTrips] = useState<any[]>([]);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [allTripsModalOpen, setAllTripsModalOpen] = useState(false);
  const [tripSearchText, setTripSearchText] = useState("");

  // Friend Request State
  const [friendState, setFriendState] = useState<
    "none" | "pending_sent" | "pending_received" | "friends" | "self"
  >("none");

  // Private & Favourite Chat States
  const [isPrivateChat, setIsPrivateChat] = useState(false);
  const [isFavouriteChat, setIsFavouriteChat] = useState(false);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pendingPrivateValue, setPendingPrivateValue] = useState<boolean>(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalType, setSuccessModalType] = useState<"locked" | "unlocked">("locked");

  // Animation for opening user details modal (Smooth Entrance - 4th change)
  const modalFadeAnim = useRef(new Animated.Value(0)).current;
  const modalScaleAnim = useRef(new Animated.Value(0.92)).current;

  // Custom Frosted Confirmation Popup State (2nd change)
  const [confirmModalType, setConfirmModalType] = useState<
    "remove_friend" | "block_user" | "delete_chat" | "clear_chat" | null
  >(null);
  const confirmFadeAnim = useRef(new Animated.Value(0)).current;
  const confirmScaleAnim = useRef(new Animated.Value(0.88)).current;

  // Custom Wallpaper Picker State (WhatsApp style, local only)
  const [wallpaperModalOpen, setWallpaperModalOpen] = useState(false);
  const [currentChatWallpaper, setCurrentChatWallpaper] = useState<string | null>(null);

  // Live Wallpaper & Theme Customizer Preview (Images 3 & 4)
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewWallpaperUri, setPreviewWallpaperUri] = useState<string | null>(null);

  // 4th change: Smooth entrance animation when user details open
  useEffect(() => {
    if (visible) {
      modalFadeAnim.setValue(0);
      modalScaleAnim.setValue(0.92);
      Animated.parallel([
        Animated.timing(modalFadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(modalScaleAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Entrance animation for custom frosted confirmation dialogs
  useEffect(() => {
    if (confirmModalType) {
      confirmFadeAnim.setValue(0);
      confirmScaleAnim.setValue(0.88);
      Animated.parallel([
        Animated.timing(confirmFadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(confirmScaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [confirmModalType]);

  // Load custom local chat wallpaper on open
  useEffect(() => {
    if (!currentUser || !targetUid) return;
    const chatId = [currentUser.uid, targetUid].sort().join("_");
    AsyncStorage.getItem(`@bunkmates_custom_chat_wallpaper_${chatId}`).then((saved) => {
      if (saved) setCurrentChatWallpaper(saved);
    });
  }, [visible, currentUser?.uid, targetUid]);

  // ─────────────────────────────────────────────────────────────
  // 1. OFFLINE-FIRST CACHE LOADER (WhatsApp Style)
  // When modal opens or targetUid changes:
  // - Immediately load real cached profile from AsyncStorage
  // - Never show blank loading screen or dummy placeholders
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !targetUid) return;

    // Use initialUserData right away if provided
    if (initialUserData && (initialUserData.uid === targetUid || initialUserData.id === targetUid)) {
      setUserProfile((prev: any) => prev || initialUserData);
    }

    const cacheKey = `@bunkmates_user_profile_cache_${targetUid}`;

    // Load local cache synchronously from AsyncStorage
    AsyncStorage.getItem(cacheKey).then((cachedStr) => {
      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr);
          if (cached.userProfile) setUserProfile(cached.userProfile);
          if (Array.isArray(cached.mutualFriends)) setMutualFriends(cached.mutualFriends);
          if (Array.isArray(cached.commonGroups)) setCommonGroups(cached.commonGroups);
          if (Array.isArray(cached.commonTrips)) setCommonTrips(cached.commonTrips);
          if (cached.nickname) setNickname(cached.nickname);
          setLoading(false);
        } catch (e) {}
      }
    });

    // Also check saved nickname
    if (currentUser) {
      const chatId = [currentUser.uid, targetUid].sort().join("_");
      AsyncStorage.getItem(`@bunkmates_nickname_${chatId}`).then((nick) => {
        if (nick) setNickname(nick);
      });
    }
  }, [visible, targetUid]);

  // ─────────────────────────────────────────────────────────────
  // 2. BACKGROUND FRESH FETCH (Offline-tolerant)
  // Fetches latest Firestore data and silently updates local cache
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !targetUid || !currentUser) return;

    let isMounted = true;

    const fetchFreshProfileData = async () => {
      try {
        if (!userProfile) setLoading(true);

        const chatId = [currentUser.uid, targetUid].sort().join("_");

        // 1. Target User Document & Current User Document in Parallel
        const [userSnap, mySnap, chatSnap] = await Promise.all([
          getDoc(doc(db, "users", targetUid)).catch(() => null),
          getDoc(doc(db, "users", currentUser.uid)).catch(() => null),
          getDoc(doc(db, "chats", chatId)).catch(() => null),
        ]);

        let freshProfile = userProfile;
        if (userSnap && userSnap.exists()) {
          freshProfile = { id: userSnap.id, uid: userSnap.id, ...userSnap.data() };
          if (isMounted) setUserProfile(freshProfile);
        }

        // 2. Nickname from Chat
        let freshNickname = nickname;
        if (chatSnap && chatSnap.exists()) {
          const cData = chatSnap.data();
          if (cData.nicknames && cData.nicknames[targetUid]) {
            freshNickname = cData.nicknames[targetUid];
            if (isMounted) setNickname(freshNickname);
            AsyncStorage.setItem(`@bunkmates_nickname_${chatId}`, freshNickname).catch(() => {});
          }
        }

        const candidateMutualUids = new Set<string>();
        const extractMemberUid = (m: any) =>
          typeof m === "string" ? m.trim() : (m?.uid || m?.id || "").trim();

        // 3. Common Trips & Trip Mutuals
        const matchedTrips: any[] = [];
        try {
          const tripsQ = query(
            collection(db, "trips"),
            where("members", "array-contains", currentUser.uid)
          );
          const tripsSnap = await getDocs(tripsQ).catch(() => null);

          if (tripsSnap && !tripsSnap.empty) {
            for (const tDoc of tripsSnap.docs) {
              const tData = tDoc.data();
              const rawMembers = tData.members || [];
              const memberUids = rawMembers.map(extractMemberUid).filter(Boolean);

              if (memberUids.includes(targetUid)) {
                memberUids.forEach((mId: string) => {
                  if (mId && mId !== currentUser.uid && mId !== targetUid) {
                    candidateMutualUids.add(mId);
                  }
                });

                matchedTrips.push({
                  id: tDoc.id,
                  name: tData.name || tData.destination || "Bunk Trip",
                  location: `${tData.from || tData.origin || "Origin"} → ${tData.location || tData.to || tData.destination || "Destination"}`,
                  startDate: tData.startDate || "Date TBD",
                  endDate: tData.endDate || "Date TBD",
                  iconURL: tData.iconURL || tData.photoURL || DEFAULT_GROUP_AVATAR,
                  completed: typeof tData.completedTasks === "number" ? tData.completedTasks : 6,
                  total: typeof tData.totalTasks === "number" ? tData.totalTasks : 7,
                });
              }
            }
          }
          if (isMounted) setCommonTrips(matchedTrips);
        } catch (e) {
          console.log("Trips fetch note:", e);
        }

        // 4. Common Groups (from groupChats, groups, and trip crew)
        const matchedGroups: any[] = [];
        try {
          const groupChatsQ = query(
            collection(db, "groupChats"),
            where("members", "array-contains", currentUser.uid)
          );
          const groupChatsSnap = await getDocs(groupChatsQ).catch(() => null);
          const allGroupDocs = [...(groupChatsSnap ? groupChatsSnap.docs : [])];

          const legacyGroupsQ = query(
            collection(db, "groups"),
            where("members", "array-contains", currentUser.uid)
          );
          const legacyGroupsSnap = await getDocs(legacyGroupsQ).catch(() => null);
          if (legacyGroupsSnap) {
            allGroupDocs.push(...legacyGroupsSnap.docs);
          }

          for (const gDoc of allGroupDocs) {
            const gData = gDoc.data();
            const rawMembers = gData.members || [];
            const memberUids = rawMembers.map(extractMemberUid).filter(Boolean);

            if (memberUids.includes(targetUid)) {
              memberUids.forEach((mId: string) => {
                if (mId && mId !== currentUser.uid && mId !== targetUid) {
                  candidateMutualUids.add(mId);
                }
              });

              const groupIcon =
                gData.iconURL ||
                gData.photoURL ||
                gData.groupChatIcon ||
                gData.groupIcon ||
                gData.imageBackgroundUrl ||
                gData.image ||
                gData.avatar ||
                DEFAULT_GROUP_AVATAR;

              if (!matchedGroups.some((g) => g.id === gDoc.id)) {
                matchedGroups.push({
                  id: gDoc.id,
                  name: gData.name || "Trip Group",
                  iconURL: groupIcon,
                  membersSummary: `${memberUids.length} members`,
                });
              }
            }
          }

          // Also add any trip group if not already present
          for (const trip of matchedTrips) {
            if (!matchedGroups.some((g) => g.id === trip.id || g.name.includes(trip.name))) {
              matchedGroups.push({
                id: trip.id,
                name: `${trip.name} Group`,
                iconURL: trip.iconURL || DEFAULT_GROUP_AVATAR,
                membersSummary: "Trip crew & bunkmates",
              });
            }
          }

          if (isMounted) setCommonGroups(matchedGroups);
        } catch (e) {
          console.log("Groups fetch note:", e);
        }

        // 5. Mutual Friends Calculation (Direct friends + Shared circle)
        let freshMutuals: any[] = [];
        try {
          const myData = mySnap?.exists() ? mySnap.data() : (currentUser as any);
          const getFriends = (u: any) => {
            const raw = u?.friends || u?.friendList || u?.friendsList || u?.connections || [];
            return (Array.isArray(raw) ? raw : []).map(extractMemberUid).filter(Boolean);
          };

          const myFriends: string[] = getFriends(myData);
          const targetFriends: string[] = getFriends(freshProfile);

          myFriends.forEach((f: string) => {
            if (targetFriends.includes(f) && f !== currentUser.uid && f !== targetUid) {
              candidateMutualUids.add(f);
            }
          });

          // Check cached trips for any shared members
          try {
            const cachedTripsStr = await AsyncStorage.getItem(`bunkmate.cachedTrips.${currentUser.uid}`);
            if (cachedTripsStr) {
              const parsedTrips = JSON.parse(cachedTripsStr);
              if (Array.isArray(parsedTrips)) {
                parsedTrips.forEach((t: any) => {
                  const mUids = (t.members || []).map(extractMemberUid).filter(Boolean);
                  if (mUids.includes(targetUid)) {
                    mUids.forEach((mId: string) => {
                      if (mId && mId !== currentUser.uid && mId !== targetUid) {
                        candidateMutualUids.add(mId);
                      }
                    });
                  }
                });
              }
            }
          } catch (e) {}

          // Check cached groups for any shared members
          try {
            const cachedGroupsStr = await AsyncStorage.getItem(`@bunkmates_cached_groups_${currentUser.uid}`);
            if (cachedGroupsStr) {
              const parsedGroups = JSON.parse(cachedGroupsStr);
              if (Array.isArray(parsedGroups)) {
                parsedGroups.forEach((g: any) => {
                  const mUids = (g.members || []).map(extractMemberUid).filter(Boolean);
                  if (mUids.includes(targetUid)) {
                    mUids.forEach((mId: string) => {
                      if (mId && mId !== currentUser.uid && mId !== targetUid) {
                        candidateMutualUids.add(mId);
                      }
                    });
                  }
                });
              }
            }
          } catch (e) {}

          const candidateArr = Array.from(candidateMutualUids).slice(0, 20);
          if (candidateArr.length > 0) {
            const fetched = await Promise.all(
              candidateArr.map(async (mUid) => {
                try {
                  const mSnap = await getDoc(doc(db, "users", mUid)).catch(() => null);
                  if (mSnap && mSnap.exists()) {
                    return { id: mSnap.id, uid: mSnap.id, ...mSnap.data() };
                  }
                } catch (e) {}
                return {
                  id: mUid,
                  uid: mUid,
                  displayName: "BunkMate Friend",
                  username: "friend",
                  photoURL: DEFAULT_GROUP_AVATAR,
                };
              })
            );
            freshMutuals = fetched.filter(Boolean);
          }

          if (isMounted) setMutualFriends(freshMutuals);
        } catch (e) {
          console.log("Mutual friends note:", e);
        }

        // 6. Save complete payload to AsyncStorage for instant offline hydration
        const cachePayload = {
          userProfile: freshProfile,
          mutualFriends: freshMutuals,
          commonGroups: matchedGroups,
          commonTrips: matchedTrips,
          nickname: freshNickname,
          cachedAt: Date.now(),
        };
        await AsyncStorage.setItem(
          `@bunkmates_user_profile_cache_${targetUid}`,
          JSON.stringify(cachePayload)
        ).catch(() => {});
      } catch (err) {
        console.log("Offline mode: utilizing cached profile data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFreshProfileData();

    return () => {
      isMounted = false;
    };
  }, [visible, targetUid, currentUser?.uid]);

  // Sync Private & Favourite status
  useEffect(() => {
    if (!visible || !targetUid || !currentUser) return;
    const chatId = [currentUser.uid, targetUid].sort().join("_");

    AsyncStorage.getItem(`@bunkmates_private_chats_${currentUser.uid}`).then((cached) => {
      if (cached) {
        try {
          const list: string[] = JSON.parse(cached);
          setIsPrivateChat(list.includes(chatId) || list.includes(targetUid));
        } catch (e) {}
      }
    });

    AsyncStorage.getItem(`@bunkmates_favourite_chats_${currentUser.uid}`).then((cached) => {
      if (cached) {
        try {
          const list: string[] = JSON.parse(cached);
          setIsFavouriteChat(list.includes(chatId) || list.includes(targetUid));
        } catch (e) {}
      }
    });

    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const pList: string[] = d.privateChatIds || [];
        const fList: string[] = d.favouriteChatIds || [];
        setIsPrivateChat(pList.includes(chatId) || pList.includes(targetUid));
        setIsFavouriteChat(fList.includes(chatId) || fList.includes(targetUid));
      }
    });

    return () => unsub();
  }, [visible, targetUid, currentUser]);

  const onSwitchPrivateChat = (val: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setPendingPrivateValue(val);
    setPinModalVisible(true);
  };

  const handlePinSuccess = () => {
    executeTogglePrivateChat(pendingPrivateValue);
  };

  const executeTogglePrivateChat = async (val: boolean) => {
    if (!currentUser || !targetUid) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
    setIsPrivateChat(val);
    const chatId = [currentUser.uid, targetUid].sort().join("_");
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const cached = await AsyncStorage.getItem(`@bunkmates_private_chats_${currentUser.uid}`);
      let parsed: string[] = cached ? JSON.parse(cached) : [];

      if (val) {
        await updateDoc(userRef, {
          privateChatIds: arrayUnion(chatId, targetUid),
        });
        if (!parsed.includes(chatId)) parsed.push(chatId);
        if (!parsed.includes(targetUid)) parsed.push(targetUid);
        await AsyncStorage.setItem(`@bunkmates_private_chats_${currentUser.uid}`, JSON.stringify(parsed));
        setSuccessModalType("locked");
        setSuccessModalVisible(true);
      } else {
        await updateDoc(userRef, {
          privateChatIds: arrayRemove(chatId, targetUid),
        });
        parsed = parsed.filter((id) => id !== chatId && id !== targetUid);
        await AsyncStorage.setItem(`@bunkmates_private_chats_${currentUser.uid}`, JSON.stringify(parsed));
        setSuccessModalType("unlocked");
        setSuccessModalVisible(true);
      }
    } catch (err) {
      console.error("Error toggling private chat:", err);
    }
  };

  const handleToggleFavouriteChat = async (val: boolean) => {
    if (!currentUser || !targetUid) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setIsFavouriteChat(val);
    const chatId = [currentUser.uid, targetUid].sort().join("_");
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const cached = await AsyncStorage.getItem(`@bunkmates_favourite_chats_${currentUser.uid}`);
      let parsed: string[] = cached ? JSON.parse(cached) : [];

      if (val) {
        await updateDoc(userRef, {
          favouriteChatIds: arrayUnion(chatId, targetUid),
        });
        if (!parsed.includes(chatId)) parsed.push(chatId);
        if (!parsed.includes(targetUid)) parsed.push(targetUid);
        await AsyncStorage.setItem(`@bunkmates_favourite_chats_${currentUser.uid}`, JSON.stringify(parsed));
      } else {
        await updateDoc(userRef, {
          favouriteChatIds: arrayRemove(chatId, targetUid),
        });
        parsed = parsed.filter((id) => id !== chatId && id !== targetUid);
        await AsyncStorage.setItem(`@bunkmates_favourite_chats_${currentUser.uid}`, JSON.stringify(parsed));
      }
    } catch (err) {
      console.error("Error toggling favourite chat:", err);
    }
  };

  // Save Nickname
  const handleSaveNickname = async (savedNickname?: string) => {
    if (!currentUser || !targetUid) return;
    const newNickname = (savedNickname !== undefined ? savedNickname : tempNickname).trim();
    setNickname(newNickname);
    setNicknameModalOpen(false);

    try {
      const chatId = [currentUser.uid, targetUid].sort().join("_");
      await AsyncStorage.setItem(`@bunkmates_nickname_${chatId}`, newNickname);
      await updateDoc(doc(db, "chats", chatId), {
        [`nicknames.${targetUid}`]: newNickname,
      }).catch(async () => {
        await setDoc(
          doc(db, "chats", chatId),
          {
            participants: [currentUser.uid, targetUid],
            nicknames: { [targetUid]: newNickname },
          },
          { merge: true }
        );
      });
      Alert.alert("Saved", `Nickname updated to "${newNickname || displayName}"`);
    } catch (e) {
      console.error(e);
    }
  };

  // Phone Press: Call or Copy
  const handlePhonePress = () => {
    const phone =
      userProfile?.mobile ||
      userProfile?.phoneNumber ||
      userProfile?.phone;

    if (!phone) {
      Alert.alert("Phone Number", "This user hasn't added a phone number yet.");
      return;
    }

    Alert.alert(
      "Phone Number",
      phone,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Copy",
          onPress: async () => {
            await Clipboard.setStringAsync(phone);
            Alert.alert("Copied", "Phone number copied to clipboard!");
          },
        },
        {
          text: "Call",
          onPress: () => {
            Linking.openURL(`tel:${phone}`);
          },
        },
      ]
    );
  };

  // Chat Press: Open direct chat
  const handleChatPress = () => {
    onClose();
    if (onStartChat && targetUid) {
      onStartChat(targetUid);
    } else if (targetUid) {
      setTimeout(() => {
        router.push(`/chat/${targetUid}` as any);
      }, 80);
    }
  };

  // Profile Press: User specifically requested clicking the profile button to open chat page
  const handleProfilePress = () => {
    handleChatPress();
  };

  // Action Handlers (Open Custom Frosted Confirmation Popup - NO native Alert!)
  const handleDeleteChat = () => {
    setConfirmModalType("delete_chat");
  };

  const handleBlockUser = () => {
    setConfirmModalType("block_user");
  };

  const handleRemoveFriend = () => {
    setConfirmModalType("remove_friend");
  };

  const handleClearChat = () => {
    setConfirmModalType("clear_chat");
  };

  // Execute Confirmed Destructive Action
  const executeConfirmAction = async () => {
    const action = confirmModalType;
    setConfirmModalType(null);
    if (!currentUser || !targetUid) return;

    if (action === "clear_chat") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        const chatId = [currentUser.uid, targetUid].sort().join("_");
        const msgsRef = collection(db, "chats", chatId, "messages");
        const msgsSnap = await getDocs(msgsRef).catch(() => null);
        if (msgsSnap && !msgsSnap.empty) {
          const batch = writeBatch(db);
          msgsSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit().catch(() => {});
        }
        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: "",
          lastMessageSenderId: "",
          lastTimestamp: Date.now(),
        }).catch(() => {});
        await AsyncStorage.removeItem(`@bunkmates_chat_msgs_${chatId}`).catch(() => {});
      } catch (e) {
        console.error("Error clearing chat:", e);
      }
    } else if (action === "delete_chat") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        const chatId = [currentUser.uid, targetUid].sort().join("_");
        await deleteDoc(doc(db, "chats", chatId)).catch(() => {});
        await AsyncStorage.removeItem(`@bunkmates_chat_msgs_${chatId}`).catch(() => {});
        onClose();
      } catch (e) {
        console.error(e);
      }
    } else if (action === "block_user") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await updateDoc(doc(db, "users", currentUser.uid), {
          blockedUsers: arrayUnion(targetUid),
        }).catch(() => {});
        onClose();
      } catch (e) {
        console.error(e);
      }
    } else if (action === "remove_friend") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await updateDoc(doc(db, "users", currentUser.uid), {
          friends: arrayRemove(targetUid),
        }).catch(() => {});
        await updateDoc(doc(db, "users", targetUid), {
          friends: arrayRemove(currentUser.uid),
        }).catch(() => {});
        setFriendState("none");
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Wallpaper Handlers (WhatsApp Style: Local Storage Only!)
  const handlePickWallpaperFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Please allow photo access to choose custom chat wallpaper.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const pickedUri = result.assets[0].uri;
        setWallpaperModalOpen(false);
        setPreviewWallpaperUri(pickedUri);
        setPreviewModalVisible(true);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {}
      }
    } catch (e) {
      console.error("Error picking wallpaper:", e);
    }
  };

  const handleSelectPresetWallpaper = async (wpId: string, uri?: string) => {
    if (!currentUser || !targetUid) return;
    const chatId = [currentUser.uid, targetUid].sort().join("_");
    if (wpId === "default") {
      await AsyncStorage.removeItem(`@bunkmates_custom_chat_wallpaper_${chatId}`);
      setCurrentChatWallpaper(null);
      onWallpaperChange?.(null);
      setWallpaperModalOpen(false);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
      return;
    }
    const val = uri || wpId;
    setWallpaperModalOpen(false);
    setPreviewWallpaperUri(val);
    setPreviewModalVisible(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  if (!visible) return null;

  // Real fields
  const displayName =
    userProfile?.displayName ||
    userProfile?.name ||
    userProfile?.username ||
    "BunkMate Traveler";

  const photoURL =
    userProfile?.photoURL ||
    userProfile?.avatar ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200";

  const handleText = userProfile?.username
    ? `@${userProfile.username}`
    : "@bunkmate";

  const bioText =
    userProfile?.bio ||
    userProfile?.about ||
    userProfile?.status ||
    "No bio available yet.";

  const phoneNumberText =
    userProfile?.mobile ||
    userProfile?.phoneNumber ||
    userProfile?.phone ||
    "Phone not shared";

  const topPad = Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : insets.top + 8;

  const displayedGroups = showAllGroups ? commonGroups : commonGroups.slice(0, 3);
  const displayedTrips = showAllTrips ? commonTrips : commonTrips.slice(0, 1);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
    >
      <View style={styles.modalRoot}>
        {/* ── FULL BACKGROUND FROSTED BLUR & ADAPTIVE CONTRAST SCRIM ── */}
        <BlurView
          intensity={Platform.OS === "ios" ? 85 : 100}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Adaptive Dark-Glass Scrim: Preserves wallpaper blur underneath while guaranteeing high contrast and readability */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(10, 14, 22, 0.78)" },
          ]}
          pointerEvents="none"
        />

        {loading && !userProfile ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00e6b0" />
          </View>
        ) : (
          <Animated.View
            style={{
              flex: 1,
              opacity: modalFadeAnim,
              transform: [{ scale: modalScaleAnim }],
            }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingTop: topPad,
                  paddingBottom: Math.max(insets.bottom, 20) + 36,
                },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* ── TOP HEADER: FLOATING BACK BUTTON PILL (Scrolls naturally with content!) ── */}
              <View style={styles.topHeaderBar}>
                <Pressable style={styles.backBtnPill} onPress={onClose}>
                  <Ionicons name="arrow-back" size={17} color="#ffffff" />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              </View>

              {/* ── HERO SECTION: Large Avatar, Name, @Handle, Name Pill (Image 1 Style) ── */}
              <View style={styles.heroSection}>
                <View style={styles.avatarGlowContainer}>
                  <Image source={{ uri: photoURL }} style={styles.heroAvatar} />
                </View>
                <Text style={styles.heroName}>{nickname || displayName}</Text>
                <Text style={styles.heroHandle}>{handleText}</Text>
                {displayName ? (
                  <View style={styles.namePill}>
                    <Text style={styles.namePillText}>{displayName}</Text>
                  </View>
                ) : null}
              </View>

              {/* ── SECTION 1: USER DETAILS CARDS (Image 1 Style) ── */}
              <View style={styles.cardsWrapper}>
                {/* Bio Card */}
                <View style={styles.cardItem}>
                  <Text style={styles.bioText}>
                    <Text style={styles.bioLabel}>Bio: </Text>
                    {bioText}
                  </Text>
                </View>

                {/* Mutual Friends Row */}
                <Pressable style={styles.cardItemRow} onPress={() => setMutualModalOpen(true)}>
                  <Text style={styles.cardRowTitle}>
                    {mutualFriends.length} Mutual Friends
                  </Text>
                  {mutualFriends.length > 0 && (
                    <View style={styles.avatarStack}>
                      {mutualFriends.slice(0, 3).map((m, i) => (
                        <Image
                          key={m.id || i}
                          source={{ uri: m.photoURL || m.avatar || DEFAULT_GROUP_AVATAR }}
                          style={[styles.stackAvatar, { right: i * 16, zIndex: 10 - i }]}
                        />
                      ))}
                    </View>
                  )}
                </Pressable>

                {/* Phone Row (Image 1 Style) */}
                <Pressable style={styles.cardItemRow} onPress={handlePhonePress}>
                  <Ionicons name="call-outline" size={19} color="#cccccc" style={{ marginRight: 12 }} />
                  <Text style={styles.cardRowPhoneText}>{phoneNumberText}</Text>
                </Pressable>

                {/* Clear Chat Row (3rd change) */}
                <Pressable style={styles.cardItemRow} onPress={handleClearChat}>
                  <Ionicons name="trash-outline" size={19} color="#ff6b6b" style={{ marginRight: 12 }} />
                  <Text style={[styles.cardRowNavText, { color: "#ff6b6b", fontWeight: "700" }]}>
                    Clear Chat
                  </Text>
                </Pressable>

                {/* Chat Wallpaper / Custom Background Row (3rd change - WhatsApp style) */}
                <Pressable style={styles.cardItemRow} onPress={() => setWallpaperModalOpen(true)}>
                  <Ionicons name="color-palette-outline" size={19} color="#00e6b0" style={{ marginRight: 12 }} />
                  <Text style={[styles.cardRowNavText, { color: "#00e6b0", fontWeight: "700" }]}>
                    Customize Chat
                  </Text>
                </Pressable>

              {/* Add a Nickname Row (Image 1 Style) */}
              <Pressable
                style={styles.cardItemRow}
                onPress={() => {
                  setTempNickname(nickname);
                  setNicknameModalOpen(true);
                }}
              >
                <MaterialCommunityIcons name="format-text" size={20} color="#cccccc" style={{ marginRight: 12 }} />
                <Text style={styles.cardRowNavText}>
                  {nickname ? `Nickname: ${nickname}` : "Add a Nickname"}
                </Text>
              </Pressable>
            </View>

            {/* ── QUICK ACTION BUTTONS: Message, Voice Call, Video Call ── */}
            {currentUser?.uid !== targetUid && (
              <View style={styles.quickCallRow}>
                <Pressable
                  style={[styles.chatActionBtn, { backgroundColor: modalAccent }]}
                  onPress={handleChatPress}
                >
                  <Ionicons name="chatbubble-ellipses" size={16} color={onModalAccentText} />
                  <Text style={[styles.chatActionBtnText, { color: onModalAccentText, fontSize: scaleFont(13) }]}>Message</Text>
                </Pressable>

                <Pressable
                  style={[styles.voiceCallBtn, { borderColor: `${modalAccent}88` }]}
                  onPress={() => {
                    onClose();
                    startCall({
                      receiverId: targetUid,
                      receiverName: displayName,
                      receiverAvatar: photoURL,
                      receiverHandle: handleText.replace("@", ""),
                      callType: "audio",
                    });
                  }}
                >
                  <Ionicons name="call" size={16} color={modalAccent} />
                  <Text style={[styles.voiceCallBtnText, { color: modalAccent, fontSize: scaleFont(13) }]}>Voice Call</Text>
                </Pressable>

                <Pressable
                  style={styles.videoCallBtn}
                  onPress={() => {
                    onClose();
                    startCall({
                      receiverId: targetUid,
                      receiverName: displayName,
                      receiverAvatar: photoURL,
                      receiverHandle: handleText.replace("@", ""),
                      callType: "video",
                    });
                  }}
                >
                  <Ionicons name="videocam" size={17} color="#ffffff" />
                  <Text style={[styles.videoCallBtnText, { fontSize: scaleFont(13) }]}>Video Call</Text>
                </Pressable>
              </View>
            )}

            {/* ── CHAT PRIVACY & PREFERENCES ── */}
            <View style={styles.sectionHeaderWrap}>
              <Text style={styles.sectionTitle}>Chat Privacy & Preferences</Text>
            </View>

            {/* Lock Chat (Private) */}
            <View style={styles.toggleRowCard}>
              <View style={styles.toggleRowLeft}>
                <View
                  style={[
                    styles.toggleIconBox,
                    {
                      backgroundColor: isPrivateChat
                        ? "rgba(16, 185, 129, 0.18)"
                        : "rgba(255, 255, 255, 0.08)",
                    },
                  ]}
                >
                  <Ionicons
                    name={isPrivateChat ? "lock-closed" : "lock-closed-outline"}
                    size={18}
                    color={isPrivateChat ? "#10b981" : "#cccccc"}
                  />
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.toggleRowTitle}>Lock Chat (Private)</Text>
                  <Text style={styles.toggleRowSubtitle}>
                    Hide from main feed; only viewable in Private tab
                  </Text>
                </View>
              </View>
              <Switch
                value={isPrivateChat}
                onValueChange={onSwitchPrivateChat}
                trackColor={{ false: "rgba(255, 255, 255, 0.15)", true: "#10b981" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Mark as Favourite */}
            <View style={styles.toggleRowCard}>
              <View style={styles.toggleRowLeft}>
                <View
                  style={[
                    styles.toggleIconBox,
                    {
                      backgroundColor: isFavouriteChat
                        ? "rgba(245, 158, 11, 0.18)"
                        : "rgba(255, 255, 255, 0.08)",
                    },
                  ]}
                >
                  <Ionicons
                    name={isFavouriteChat ? "star" : "star-outline"}
                    size={18}
                    color={isFavouriteChat ? "#f59e0b" : "#cccccc"}
                  />
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.toggleRowTitle}>Mark as Favourite</Text>
                  <Text style={styles.toggleRowSubtitle}>
                    Pin to Favourites tab for instant access
                  </Text>
                </View>
              </View>
              <Switch
                value={isFavouriteChat}
                onValueChange={handleToggleFavouriteChat}
                trackColor={{ false: "rgba(255, 255, 255, 0.15)", true: "#f59e0b" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* ── SECTION 2: COMMON GROUPS (Image 1 Style) ── */}
            <View style={styles.sectionHeaderWrap}>
              <Text style={styles.sectionTitle}>Common Groups</Text>
            </View>

            {displayedGroups.length > 0 ? (
              displayedGroups.map((group) => (
                <View key={group.id} style={styles.groupCard}>
                  <View style={styles.groupIconCircle}>
                    {group.iconURL && (group.iconURL.startsWith("http") || group.iconURL.startsWith("data:") || group.iconURL.startsWith("file:")) ? (
                      <Image source={{ uri: group.iconURL }} style={styles.groupAvatarImg} />
                    ) : (
                      <Image source={{ uri: DEFAULT_GROUP_AVATAR }} style={styles.groupAvatarImg} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>{group.name}</Text>
                    <Text style={styles.groupMembers} numberOfLines={1}>
                      {group.membersSummary}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyInlineBox}>
                <Text style={styles.emptyInlineText}>No common groups yet</Text>
              </View>
            )}

            {commonGroups.length > 3 && (
              <Pressable
                style={styles.morePillBtn}
                onPress={() => setShowAllGroups(!showAllGroups)}
              >
                <Text style={styles.morePillBtnText}>
                  {showAllGroups ? "Show less" : `${commonGroups.length - 3} more groups`}
                </Text>
              </Pressable>
            )}

            {/* ── SECTION 3: COMMON TRIPS (Image 2 Style) ── */}
            <View style={styles.sectionHeaderWrap}>
              <Text style={styles.sectionTitle}>Common Trips</Text>
            </View>

            {displayedTrips.length > 0 ? (
              displayedTrips.map((trip) => (
                <Pressable
                  key={trip.id}
                  style={styles.tripCard}
                  onPress={() => {
                    onClose();
                    if (trip.id) router.push(`/trips/${trip.id}` as any);
                  }}
                >
                  <View style={styles.tripHeaderRow}>
                    <Text style={styles.tripTitle}>{trip.name}</Text>
                    <Text style={styles.tripProgressText}>
                      {trip.completed} / {trip.total} complete
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            (trip.completed / Math.max(trip.total, 1)) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.tripMetaRow}>
                    <Feather name="map-pin" size={13} color="#888888" />
                    <Text style={styles.tripMetaText}>{trip.location}</Text>
                  </View>

                  <View style={styles.tripMetaRow}>
                    <Feather name="clock" size={13} color="#888888" />
                    <Text style={styles.tripMetaText}>
                      {trip.startDate} → {trip.endDate}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyInlineBox}>
                <Text style={styles.emptyInlineText}>No common trips yet</Text>
              </View>
            )}

            {commonTrips.length > 1 && (
              <Pressable
                style={styles.morePillBtn}
                onPress={() => setShowAllTrips(!showAllTrips)}
              >
                <Text style={styles.morePillBtnText}>
                  {showAllTrips ? "Show less" : `${commonTrips.length - 1} more trips`}
                </Text>
              </Pressable>
            )}

            {/* ── SECTION 4: DESTRUCTIVE ACTIONS (Image 2 Style) ── */}
            <View style={styles.dangerSection}>
              <Pressable style={styles.dangerCard} onPress={handleDeleteChat}>
                <Feather name="trash-2" size={18} color="#ff5252" />
                <Text style={styles.dangerCardText}>Delete Chat</Text>
              </Pressable>

              <Pressable style={styles.dangerCard} onPress={handleBlockUser}>
                <MaterialCommunityIcons name="block-helper" size={18} color="#ff5252" />
                <Text style={styles.dangerCardText}>Block Friend</Text>
              </Pressable>

              <Pressable style={styles.dangerCard} onPress={handleRemoveFriend}>
                <Ionicons name="remove-circle-outline" size={19} color="#ff5252" />
                <Text style={styles.dangerCardText}>Remove from Friend</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* ── ANIMATED NICKNAME POPUP WITH FULL FROSTED HARDWARE BLUR ── */}
      <NicknameEditModal
        visible={nicknameModalOpen}
        onClose={() => setNicknameModalOpen(false)}
        currentNickname={nickname}
        friendName={displayName}
        onSave={handleSaveNickname}
      />

      {/* ── MUTUAL FRIENDS SHEET OVERLAY (Inline - Android Safe, no nested Modal) ── */}
      {mutualModalOpen && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 99999, elevation: 99999 }]}>
          <Pressable style={styles.subModalOverlay} onPress={() => setMutualModalOpen(false)}>
            <Pressable style={styles.mutualCardSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetDragHandle} />
              <Text style={styles.mutualModalTitle}>
                Mutual Friends ({mutualFriends.length})
              </Text>

              {mutualFriends.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <Text style={{ color: "#888888", fontSize: 13.5 }}>No mutual friends found.</Text>
                </View>
              ) : (
                <FlatList
                  data={mutualFriends}
                  keyExtractor={(item, idx) => item.id || String(idx)}
                  contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.mutualUserCard}
                      onPress={() => {
                        setMutualModalOpen(false);
                        handleChatPress();
                      }}
                    >
                      <Image
                        source={{ uri: item.photoURL || item.avatar || DEFAULT_GROUP_AVATAR }}
                        style={styles.mutualAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mutualUserName}>
                          {item.displayName || item.name || "BunkMate"}
                        </Text>
                        <Text style={styles.mutualUserHandle}>@{item.username || "traveler"}</Text>
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </Pressable>
          </Pressable>
        </View>
      )}

      {/* ── CUSTOM FROSTED CONFIRMATION MODAL (No native Android Alert!) ── */}
      {confirmModalType && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              zIndex: 999999,
              elevation: 25,
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 20,
            },
          ]}
        >
          {/* Frosted Blur Backdrop */}
          <BlurView
            intensity={Platform.OS === "ios" ? 85 : 100}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(5, 8, 12, 0.82)" }]}
            pointerEvents="none"
          />

          {/* Background tap to dismiss */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setConfirmModalType(null)}
          />

          {/* Confirmation Card */}
          <Pressable
            style={styles.confirmCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header Icon Badge */}
            <View style={styles.confirmIconBadge}>
              {confirmModalType === "remove_friend" && (
                <Ionicons name="person-remove-outline" size={26} color="#ff5252" />
              )}
              {confirmModalType === "block_user" && (
                <MaterialCommunityIcons name="block-helper" size={26} color="#ff5252" />
              )}
              {confirmModalType === "delete_chat" && (
                <Feather name="trash-2" size={26} color="#ff5252" />
              )}
              {confirmModalType === "clear_chat" && (
                <Ionicons name="trash-outline" size={26} color="#ff5252" />
              )}
            </View>

            {/* Title */}
            <Text style={styles.confirmTitle}>
              {confirmModalType === "remove_friend" && "Remove Friend"}
              {confirmModalType === "block_user" && "Block Friend"}
              {confirmModalType === "delete_chat" && "Delete Chat"}
              {confirmModalType === "clear_chat" && "Clear Chat"}
            </Text>

            {/* Subtitle / Message */}
            <Text style={styles.confirmMessage}>
              {confirmModalType === "remove_friend" &&
                `Remove ${displayName} from your BunkMates friends list?`}
              {confirmModalType === "block_user" &&
                `Are you sure you want to block ${displayName}?`}
              {confirmModalType === "delete_chat" &&
                "Are you sure you want to delete this chat conversation?"}
              {confirmModalType === "clear_chat" &&
                `Are you sure you want to clear all messages with ${displayName}? This will permanently remove all chat history from both this device and servers.`}
            </Text>

            {/* Action Buttons Row */}
            <View style={styles.confirmBtnRow}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setConfirmModalType(null)}
              >
                <Text style={styles.confirmCancelBtnText}>CANCEL</Text>
              </Pressable>

              <Pressable
                style={styles.confirmActionBtn}
                onPress={executeConfirmAction}
              >
                <Text style={styles.confirmActionBtnText}>
                  {confirmModalType === "remove_friend" && "REMOVE"}
                  {confirmModalType === "block_user" && "BLOCK"}
                  {confirmModalType === "delete_chat" && "DELETE"}
                  {confirmModalType === "clear_chat" && "CLEAR"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      )}

      {/* ── CUSTOM CHAT WALLPAPER PICKER (WhatsApp Style - Local Only!) ── */}
      {wallpaperModalOpen && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              zIndex: 999999,
              elevation: 25,
              width: "100%",
              height: "100%",
              justifyContent: "flex-end",
            },
          ]}
        >
          {/* Frosted Blur Backdrop */}
          <BlurView
            intensity={Platform.OS === "ios" ? 85 : 100}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(5, 8, 12, 0.78)" }]}
            pointerEvents="none"
          />

          {/* Background tap to dismiss */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setWallpaperModalOpen(false)}
          />

          <Pressable style={styles.wallpaperSheetCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetDragHandle} />

            {/* Sheet Title & Close */}
            <View style={styles.wallpaperHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wallpaperSheetTitle}>Chat Wallpaper</Text>
                <Text style={styles.wallpaperSheetSubtitle}>
                  Custom background for {displayName} (Stored locally on device)
                </Text>
              </View>
              <Pressable
                style={styles.wallpaperCloseBtn}
                onPress={() => setWallpaperModalOpen(false)}
              >
                <Ionicons name="close" size={20} color="#ffffff" />
              </Pressable>
            </View>

            {/* Option 1: Choose from Gallery */}
            <Pressable
              style={styles.wallpaperOptionRow}
              onPress={handlePickWallpaperFromGallery}
            >
              <View style={styles.wallpaperOptionIconWrap}>
                <Ionicons name="images" size={20} color="#00e6b0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.wallpaperOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.wallpaperOptionDesc}>Pick custom photo from your phone storage</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>

            {/* Option 2: Reset to Default */}
            <Pressable
              style={styles.wallpaperOptionRow}
              onPress={() => handleSelectPresetWallpaper("default")}
            >
              <View style={[styles.wallpaperOptionIconWrap, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                <Ionicons name="refresh" size={18} color="#cccccc" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.wallpaperOptionTitle}>Default Wallpaper</Text>
                <Text style={styles.wallpaperOptionDesc}>Restore default BunkMates dark theme</Text>
              </View>
              {!currentChatWallpaper && (
                <Ionicons name="checkmark-circle" size={20} color="#00e6b0" />
              )}
            </Pressable>

            {/* Option 3: Customize Theme & Preview Bubbles */}
            <Pressable
              style={styles.wallpaperOptionRow}
              onPress={() => {
                setWallpaperModalOpen(false);
                setPreviewWallpaperUri(currentChatWallpaper || "local:chatbg:1");
                setPreviewModalVisible(true);
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (e) {}
              }}
            >
              <View style={[styles.wallpaperOptionIconWrap, { backgroundColor: "rgba(91, 71, 214, 0.2)" }]}>
                <Ionicons name="color-palette" size={19} color="#a78bfa" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.wallpaperOptionTitle}>Customize Chat Bubbles & Dim</Text>
                <Text style={styles.wallpaperOptionDesc}>Fine-tune theme colors, brightness and preview live</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>

            {/* Preset Wallpapers List */}
            <Text style={styles.presetSectionTitle}>App Wallpapers</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetScrollContainer}
            >
              {wallpaperList
                .filter((w) => w.id !== "default")
                .map((item) => {
                  const isSelected = currentChatWallpaper === item.uri || currentChatWallpaper === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.presetThumbCard,
                        isSelected && styles.presetThumbCardActive,
                      ]}
                      onPress={() => handleSelectPresetWallpaper(item.id, item.uri)}
                    >
                      <Image source={item.asset || { uri: item.uri }} style={styles.presetThumbImg} />
                      {isSelected && (
                        <View style={styles.presetActiveBadge}>
                          <Ionicons name="checkmark" size={14} color="#000000" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </Pressable>
        </View>
      )}

      {/* 6-DIGIT PRIVATE PIN MODAL (Inline) */}
      {pinModalVisible && (
        <PrivatePinModal
          visible={pinModalVisible}
          onClose={() => setPinModalVisible(false)}
          onSuccess={handlePinSuccess}
          actionTitle={pendingPrivateValue ? `Lock '${displayName}'` : `Unlock '${displayName}'`}
          mode="auto"
          inline={true}
        />
      )}

      {/* STYLISH LOCK SUCCESS DIALOG (Inline) */}
      {successModalVisible && (
        <PrivateLockSuccessModal
          visible={successModalVisible}
          onClose={() => setSuccessModalVisible(false)}
          type={successModalType}
          chatName={displayName}
          onViewPrivateTab={() => {
            onClose();
          }}
          inline={true}
        />
      )}

      {/* ── LIVE CHAT WALLPAPER & THEME CUSTOMIZER PREVIEW (Inline overlay - Android Safe!) ── */}
      {previewModalVisible && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 999999, elevation: 999999, width: "100%", height: "100%" }]}>
          <WallpaperThemePreviewModal
            visible={previewModalVisible}
            onClose={() => setPreviewModalVisible(false)}
            chatId={currentUser && targetUid ? [currentUser.uid, targetUid].sort().join("_") : ""}
            friendName={displayName}
            initialWallpaperUri={previewWallpaperUri}
            inline={true}
            onApply={(wpUri, bubbleColor, dim) => {
              setCurrentChatWallpaper(wpUri);
              onWallpaperChange?.(wpUri, bubbleColor, dim);
              setPreviewModalVisible(false);
            }}
          />
        </View>
      )}
    </View>
  </Modal>
);
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: "transparent",
  },
  topHeaderBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  backBtnPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(28, 35, 41, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  backBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  heroSection: {
    alignItems: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  avatarGlowContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#1c2329",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  heroAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#222228",
  },
  heroName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroHandle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13.5,
    marginTop: 3,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  namePill: {
    backgroundColor: "rgba(20, 26, 36, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    marginTop: 8,
  },
  namePillText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  cardsWrapper: {
    gap: 8,
  },
  cardItem: {
    backgroundColor: "rgba(20, 26, 36, 0.94)",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  cardItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 26, 36, 0.94)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  bioText: {
    color: "#e2e8f0",
    fontSize: 13.5,
    lineHeight: 20,
  },
  bioLabel: {
    fontWeight: "700",
    color: "#ffffff",
  },
  cardRowTitle: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cardRowPhoneText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  cardRowNavText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  avatarStack: {
    position: "relative",
    width: 48,
    height: 26,
  },
  stackAvatar: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#161b20",
  },
  quickCallRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  chatActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00e6b0",
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#00e6b0",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  chatActionBtnText: {
    color: "#000000",
    fontWeight: "800",
    fontSize: 13,
  },
  voiceCallBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(20, 26, 36, 0.94)",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 176, 0.55)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  voiceCallBtnText: {
    color: "#00e6b0",
    fontWeight: "800",
    fontSize: 13,
  },
  videoCallBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(20, 26, 36, 0.94)",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  videoCallBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13,
  },
  sectionHeaderWrap: {
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 26, 36, 0.94)",
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  groupIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  groupAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  groupTitle: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "700",
  },
  groupMembers: {
    color: "#888888",
    fontSize: 12,
    marginTop: 2,
  },
  morePillBtn: {
    backgroundColor: "rgba(28, 35, 41, 0.85)",
    borderRadius: 20,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  morePillBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  tripCard: {
    backgroundColor: "rgba(22, 27, 34, 0.82)",
    borderRadius: 18,
    padding: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tripHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripTitle: {
    color: "#ffffff",
    fontSize: 15.5,
    fontWeight: "800",
  },
  tripProgressText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 3,
    marginVertical: 10,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 3,
  },
  tripMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  tripMetaText: {
    color: "#888888",
    fontSize: 12.5,
  },
  dangerSection: {
    marginTop: 18,
    gap: 8,
  },
  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(28, 18, 24, 0.94)",
    borderRadius: 18,
    padding: 15,
    gap: 12,
    borderWidth: 1.2,
    borderColor: "rgba(255, 82, 82, 0.28)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  dangerCardText: {
    color: "#ff5252",
    fontSize: 14,
    fontWeight: "800",
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  nicknameCard: {
    width: "90%",
    backgroundColor: "#1c1e24",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  nicknameModalTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 14,
  },
  nicknameInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    color: "#ffffff",
    fontSize: 14,
    marginBottom: 18,
  },
  nicknameActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  nicknameCloseBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  nicknameCloseBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  nicknameSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  nicknameSaveBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
  mutualCardSheet: {
    width: "100%",
    maxHeight: "70%",
    backgroundColor: "#181a20",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  sheetDragHandle: {
    width: 38,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 10,
    alignSelf: "center",
    marginBottom: 14,
  },
  mutualModalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  mutualUserCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#242730",
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  mutualAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333",
  },
  mutualUserName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  mutualUserHandle: {
    color: "#aaaaaa",
    fontSize: 12,
    marginTop: 2,
  },
  toggleRowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(20, 26, 36, 0.94)",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  toggleRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  toggleRowTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  toggleRowSubtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyInlineBox: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22, 27, 34, 0.5)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 8,
  },
  emptyInlineText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 13,
    fontWeight: "500",
  },
  frostedModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#161b24",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 25,
  },
  confirmIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 82, 82, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 82, 82, 0.32)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmMessage: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  confirmBtnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  confirmCancelBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  confirmActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#ff5252",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmActionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  wallpaperSheetCard: {
    width: "100%",
    backgroundColor: "#161b24",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 38 : 24,
    position: "absolute",
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 25,
  },
  wallpaperHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  wallpaperSheetTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  wallpaperSheetSubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  wallpaperCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  wallpaperOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  wallpaperOptionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 230, 176, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  wallpaperOptionTitle: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "700",
  },
  wallpaperOptionDesc: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11.5,
    marginTop: 2,
  },
  presetSectionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 12,
  },
  presetScrollContainer: {
    gap: 10,
    paddingVertical: 4,
  },
  presetThumbCard: {
    width: 68,
    height: 104,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
    marginRight: 8,
  },
  presetThumbCardActive: {
    borderColor: "#00e6b0",
    borderWidth: 2.5,
  },
  presetThumbImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  presetActiveBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
  },
});

