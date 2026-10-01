import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { SafeAreaView } from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../lib/firebase";

/* ============================================================
   TYPES
============================================================ */

type NotificationItem = {
  id: string;

  uid?: string;

  type?: string;

  title?: string;

  content?: string;

  message?: string;

  senderId?: string;

  senderName?: string;

  pic?: string;

  seen?: boolean;

  read?: boolean;

  status?: string;

  timestamp?: any;

  route?: string;

  [key: string]: any;
};

type NotificationGroup = {
  sender: string;

  senderPic: string;

  groupType: string;

  groupTime: string;

  notifications: NotificationItem[];

  title: string;

  isSeen: boolean;

  latestTimestamp: any;
};

/* ============================================================
   DATE HELPERS
============================================================ */

function toDate(timestamp: any): Date | null {
  if (!timestamp) {
    return null;
  }

  if (
    typeof timestamp.toDate === "function"
  ) {
    return timestamp.toDate();
  }

  if (timestamp instanceof Date) {
    return timestamp;
  }

  if (typeof timestamp === "number") {
    return new Date(timestamp);
  }

  if (typeof timestamp === "string") {
    const date = new Date(timestamp);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function formatDateLabel(
  timestamp: any
) {
  const date = toDate(timestamp);

  if (!date) {
    return "Date unknown";
  }

  const now = new Date();

  const yesterday = new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  const sameDay = (
    first: Date,
    second: Date
  ) =>
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth() &&
    first.getDate() ===
      second.getDate();

  if (sameDay(date, now)) {
    return "Today";
  }

  if (
    sameDay(
      date,
      yesterday
    )
  ) {
    return "Yesterday";
  }

  const sevenDaysAgo =
    new Date();

  sevenDaysAgo.setDate(
    sevenDaysAgo.getDate() - 7
  );

  if (date > sevenDaysAgo) {
    return date.toLocaleDateString(
      "en-US",
      {
        weekday: "long",
      }
    );
  }

  return date.toLocaleDateString(
    "en-US"
  );
}

function formatTimeLabel(
  timestamp: any
) {
  const date = toDate(timestamp);

  if (!date) {
    return "unknown";
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}-${date.getHours()}`;
}

function getGroupDisplayTime(
  timestamp: any
) {
  const date = toDate(timestamp);

  if (!date) {
    return "Time unknown";
  }

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );
}

function formatNotificationTime(
  timestamp: any
) {
  const date = toDate(timestamp);

  if (!date) {
    return "--";
  }

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );
}

function capitalize(
  value?: string
) {
  if (!value) return "";

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

/* ============================================================
   NOTIFICATION AVATAR
============================================================ */

function NotificationAvatar({
  notification,
}: {
  notification: NotificationItem;
}) {
  if (notification.pic) {
    return (
      <Image
        source={{
          uri: notification.pic,
        }}
        style={styles.avatar}
      />
    );
  }

  let icon:
    | keyof typeof Ionicons.glyphMap =
    "notifications-outline";

  if (
    notification.type === "chat"
  ) {
    icon = "chatbubble-outline";
  }

  if (
    notification.type ===
    "friend_request"
  ) {
    icon = "person-add-outline";
  }

  if (
    notification.type ===
    "friend_accepted"
  ) {
    icon = "people-outline";
  }

  if (
    notification.type ===
    "feedback"
  ) {
    icon = "chatbox-ellipses-outline";
  }

  if (
    notification.type ===
    "like"
  ) {
    icon = "heart-outline";
  }

  return (
    <View style={styles.systemAvatar}>
      <Ionicons
        name={icon}
        size={20}
        color="#050505"
      />
    </View>
  );
}

/* ============================================================
   MAIN SCREEN
============================================================ */

export default function Notifications() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      notificationId?: string;
    }>();

  const [
    notifications,
    setNotifications,
  ] = useState<NotificationItem[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    currentUser,
    setCurrentUser,
  ] = useState<any>(null);

  const [
    filter,
    setFilter,
  ] = useState("all");

  const [
    selectedNotification,
    setSelectedNotification,
  ] =
    useState<NotificationItem | null>(
      null
    );

  const [
    globalUserView,
    setGlobalUserView,
  ] = useState(false);

  const [
    expandedDetailId,
    setExpandedDetailId,
  ] = useState<string | null>(
    null
  );

  /*
   * Used to prevent showing local Android
   * notifications for all old Firestore
   * documents when the listener first starts.
   */
  const initializedNotifications =
    useRef(false);

  const knownNotificationIds =
    useRef<Set<string>>(
      new Set()
    );

  /* ==========================================================
     AUTH
  ========================================================== */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          setCurrentUser(user);
        }
      );

    return unsubscribe;
  }, []);

  /* ==========================================================
     FIRESTORE REALTIME NOTIFICATIONS
  ========================================================== */

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);

      initializedNotifications.current =
        false;

      knownNotificationIds.current =
        new Set();

      return;
    }

    setLoading(true);

    const notificationQuery =
      query(
        collection(
          db,
          "notifications"
        ),
        where(
          "uid",
          "==",
          currentUser.uid
        ),
        orderBy(
          "timestamp",
          "desc"
        )
      );

    const unsubscribe =
      onSnapshot(
        notificationQuery,
        async (snapshot) => {
          const data =
            snapshot.docs.map(
              (notificationDoc) => ({
                id: notificationDoc.id,
                ...notificationDoc.data(),
              })
            ) as NotificationItem[];

          /*
           * ----------------------------------------------------
           * FIRST SNAPSHOT
           *
           * Add all current IDs to known list but DO NOT
           * generate Android notifications for old data.
           * ----------------------------------------------------
           */

          if (
            !initializedNotifications.current
          ) {
            data.forEach(
              (notification) => {
                knownNotificationIds.current.add(
                  notification.id
                );
              }
            );

            initializedNotifications.current =
              true;
          } else {
            /*
             * --------------------------------------------------
             * NEW FIRESTORE NOTIFICATIONS
             * --------------------------------------------------
             */

            const newNotifications =
              data.filter(
                (notification) =>
                  !knownNotificationIds.current.has(
                    notification.id
                  )
              );

            /*
             * Remember IDs immediately.
             */

            newNotifications.forEach(
              (notification) => {
                knownNotificationIds.current.add(
                  notification.id
                );
              }
            );

          }

          setNotifications(data);
          setLoading(false);
        },
        (error) => {
          console.error(
            "Notification Firestore error:",
            error
          );

          setNotifications([]);
          setLoading(false);
        }
      );

    return unsubscribe;
  }, [currentUser]);

  /* ==========================================================
     OPEN NOTIFICATION FROM PARAM
  ========================================================== */

  useEffect(() => {
    if (!params.notificationId) {
      return;
    }

    const notification =
      notifications.find(
        (item) =>
          item.id ===
          params.notificationId
      );

    if (notification) {
      setSelectedNotification(
        notification
      );
    }
  }, [
    params.notificationId,
    notifications,
  ]);

  /* ==========================================================
     DYNAMIC TYPES
  ========================================================== */

  const notificationTypes =
    useMemo(() => {
      const types =
        new Set<string>();

      notifications.forEach(
        (notification) => {
          if (
            notification.type &&
            notification.type !==
              "chat"
          ) {
            types.add(
              notification.type
            );
          }
        }
      );

      return Array.from(types);
    }, [notifications]);

  /* ==========================================================
     FILTER
  ========================================================== */

  const filteredNotifications =
    useMemo(() => {
      if (filter === "all") {
        return notifications;
      }

      if (filter === "unreads") {
        return notifications.filter(
          (notification) =>
            !notification.seen
        );
      }

      return notifications.filter(
        (notification) =>
          notification.type ===
          filter
      );
    }, [
      notifications,
      filter,
    ]);

  /* ==========================================================
     GROUPING
  ========================================================== */

  const groupedNotifications =
    useMemo(() => {
      if (
        filteredNotifications.length ===
        0
      ) {
        return {};
      }

      const byDate =
        filteredNotifications.reduce(
          (
            accumulator: Record<
              string,
              NotificationItem[]
            >,
            notification
          ) => {
            const dateLabel =
              formatDateLabel(
                notification.timestamp
              );

            if (
              !accumulator[
                dateLabel
              ]
            ) {
              accumulator[
                dateLabel
              ] = [];
            }

            accumulator[
              dateLabel
            ].push(notification);

            return accumulator;
          },
          {}
        );

      const result: Record<
        string,
        NotificationGroup[]
      > = {};

      Object.keys(byDate).forEach(
        (dateLabel) => {
          const byHour =
            byDate[
              dateLabel
            ].reduce(
              (
                accumulator: Record<
                  string,
                  NotificationGroup
                >,
                notification
              ) => {
                const timeKey =
                  formatTimeLabel(
                    notification.timestamp
                  );

                const sender =
                  notification.senderId ||
                  "system";

                const type =
                  notification.type ||
                  "general";

                const key = `${sender}_${type}_${timeKey}`;

                if (
                  !accumulator[key]
                ) {
                  accumulator[
                    key
                  ] = {
                    sender,
                    senderPic:
                      notification.pic ||
                      "",
                    groupType:
                      type,
                    groupTime:
                      getGroupDisplayTime(
                        notification.timestamp
                      ),
                    notifications: [],
                    title:
                      notification.title ||
                      "Notification",
                    isSeen:
                      notification.seen !==
                      false,
                    latestTimestamp:
                      notification.timestamp,
                  };
                }

                accumulator[
                  key
                ].notifications.push(
                  notification
                );

                if (
                  notification.seen ===
                  false
                ) {
                  accumulator[
                    key
                  ].isSeen = false;
                }

                return accumulator;
              },
              {}
            );

          result[
            dateLabel
          ] = Object.values(
            byHour
          ).sort(
            (first, second) =>
              (toDate(
                second.latestTimestamp
              )?.getTime() || 0) -
              (toDate(
                first.latestTimestamp
              )?.getTime() || 0)
          );
        }
      );

      return result;
    }, [
      filteredNotifications,
    ]);

  /* ==========================================================
     MARK GROUP READ
  ========================================================== */

  const markGroupAsRead =
    async (
      group: NotificationGroup
    ) => {
      if (!group) return;

      const unread =
        group.notifications.filter(
          (notification) =>
            notification.seen === false
        );

      try {
        await Promise.all(
          unread.map(
            (notification) =>
              updateDoc(
                doc(
                  db,
                  "notifications",
                  notification.id
                ),
                {
                  seen: true,
                  read: true,
                }
              )
          )
        );
      } catch (error) {
        console.error(
          "Failed to mark notifications read:",
          error
        );
      }
    };

  /* ==========================================================
     DELETE
  ========================================================== */

  const deleteNotification =
    async (
      id: string
    ) => {
      try {
        await deleteDoc(
          doc(
            db,
            "notifications",
            id
          )
        );

        knownNotificationIds.current.delete(
          id
        );

        if (
          selectedNotification?.id ===
          id
        ) {
          setSelectedNotification(
            null
          );
        }
      } catch (error) {
        console.error(
          "Failed to delete notification:",
          error
        );
      }
    };

  /* ==========================================================
     ACCEPT FRIEND REQUEST
  ========================================================== */

  const handleAcceptRequest =
    async (
      notification: NotificationItem
    ) => {
      const currentUid =
        auth.currentUser?.uid;

      if (!currentUid) {
        return;
      }

      if (!notification.senderId) {
        return;
      }

      try {
        await updateDoc(
          doc(
            db,
            "notifications",
            notification.id
          ),
          {
            status: "accepted",
            seen: true,
            read: true,
            message:
              "You are now friends!",
            content:
              "You are now friends!",
          }
        );

        await Promise.all([
          updateDoc(
            doc(
              db,
              "users",
              currentUid
            ),
            {
              friends:
                arrayUnion(
                  notification.senderId
                ),
            }
          ),

          updateDoc(
            doc(
              db,
              "users",
              notification.senderId
            ),
            {
              friends:
                arrayUnion(
                  currentUid
                ),
            }
          ),
        ]);

        await setDoc(
          doc(
            db,
            "notifications",
            `${notification.senderId}_${currentUid}_friend_accepted_${Date.now()}`
          ),
          {
            type:
              "friend_accepted",

            senderId:
              currentUid,

            uid:
              notification.senderId,

            title:
              "Friend Request Accepted",

            content:
              `${
                auth.currentUser
                  ?.displayName ||
                "A user"
              } accepted your friend request.`,

            message:
              `${
                auth.currentUser
                  ?.displayName ||
                "A user"
              } accepted your friend request.`,

            pic:
              auth.currentUser
                ?.photoURL ||
              "",

            seen: false,

            read: false,

            timestamp:
              new Date(),
          }
        );

        Alert.alert(
          "Friends",
          "You are now friends!"
        );
      } catch (error) {
        console.error(
          "Error accepting friend request:",
          error
        );

        Alert.alert(
          "Error",
          "Could not accept friend request."
        );
      }
    };

  /* ==========================================================
     REJECT FRIEND REQUEST
  ========================================================== */

  const handleRejectRequest =
    async (
      notification: NotificationItem
    ) => {
      try {
        await updateDoc(
          doc(
            db,
            "notifications",
            notification.id
          ),
          {
            status: "rejected",
            seen: true,
            read: true,
            message:
              "Friend request rejected.",
            content:
              "Friend request rejected.",
          }
        );
      } catch (error) {
        console.error(
          "Error rejecting friend request:",
          error
        );

        Alert.alert(
          "Error",
          "Could not reject friend request."
        );
      }
    };

  /* ==========================================================
     GROUP CLICK
  ========================================================== */

  const handleGroupClick =
    async (
      group: NotificationGroup
    ) => {
      await markGroupAsRead(
        group
      );

      setGlobalUserView(false);
      setExpandedDetailId(null);

      if (
        group.notifications
          .length > 0
      ) {
        setSelectedNotification(
          group.notifications[0]
        );
      }
    };

  /* ==========================================================
     NOTIFICATION DETAIL CLICK
  ========================================================== */

  const handlePopupNotificationClick =
    (
      notification: NotificationItem
    ) => {
      if (
        notification.type ===
          "chat" &&
        notification.senderId
      ) {
        setSelectedNotification(
          null
        );

        router.push({
          pathname:
            `/chat/${notification.senderId}` as any,

          params: {
            displayName:
              notification.title ||
              notification.senderName ||
              "Chat",

            photoURL:
              notification.pic ||
              "",
          },
        });

        return;
      }

      if (
        notification.type ===
        "friend_request"
      ) {
        return;
      }

      setExpandedDetailId(
        (previous) =>
          previous ===
          notification.id
            ? null
            : notification.id
      );
    };

  /* ==========================================================
     BACK
  ========================================================== */

  const handleBack =
    () => {
      router.back();
    };

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#080808"
      />

      {/* ======================================================
          HEADER
      ====================================================== */}

      <View
        style={styles.header}
      >
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={21}
            color="#eeeeee"
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          Notifications
        </Text>
      </View>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.filters
        }
      >
        <FilterChip
          label="All"
          active={
            filter === "all"
          }
          onPress={() =>
            setFilter("all")
          }
        />

        <FilterChip
          label="Unreads"
          active={
            filter ===
            "unreads"
          }
          onPress={() =>
            setFilter("unreads")
          }
        />

        <FilterChip
          label="Chat"
          active={
            filter === "chat"
          }
          onPress={() =>
            setFilter("chat")
          }
        />

        {notificationTypes.map(
          (type) => (
            <FilterChip
              key={type}
              label={capitalize(
                type
              )}
              active={
                filter === type
              }
              onPress={() =>
                setFilter(type)
              }
            />
          )
        )}
      </ScrollView>

      {/* ======================================================
          LIST
      ====================================================== */}

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.listContent
        }
      >
        {loading && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff9d18" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View
            style={
              styles.emptyContainer
            }
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Ionicons
                name="notifications-off-outline"
                size={28}
                color="#888888"
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No notifications
            </Text>

            <Text
              style={
                styles.emptySubtitle
              }
            >
              No notifications found
              for this filter.
            </Text>
          </View>
        ) : (
          <>
            {Object.keys(
              groupedNotifications
            ).map(
              (dateLabel) => (
                <View
                  key={dateLabel}
                >
                  <Text
                    style={
                      styles.dateLabel
                    }
                  >
                    {dateLabel.toUpperCase()}
                  </Text>

                  {groupedNotifications[
                    dateLabel
                  ].map(
                    (
                      group,
                      groupIndex
                    ) => (
                      <NotificationCard
                        key={`${dateLabel}-${groupIndex}`}
                        group={group}
                        onPress={() =>
                          handleGroupClick(
                            group
                          )
                        }
                        onMarkRead={() =>
                          markGroupAsRead(
                            group
                          )
                        }
                        onDelete={() =>
                          deleteNotification(
                            group
                              .notifications[0]
                              .id
                          )
                        }
                        onAccept={() =>
                          handleAcceptRequest(
                            group
                              .notifications[0]
                          )
                        }
                        onReject={() =>
                          handleRejectRequest(
                            group
                              .notifications[0]
                          )
                        }
                      />
                    )
                  )}
                </View>
              )
            )}

          </>
        )}
      </ScrollView>

      {/* ======================================================
          DETAIL MODAL
      ====================================================== */}

      <Modal
        visible={
          !!selectedNotification
        }
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelectedNotification(
            null
          );

          setGlobalUserView(false);
        }}
      >
        {selectedNotification && (
          <NotificationDetail
            selectedNotification={
              selectedNotification
            }
            notifications={
              notifications
            }
            groupedNotifications={
              groupedNotifications
            }
            globalUserView={
              globalUserView
            }
            setGlobalUserView={
              setGlobalUserView
            }
            expandedDetailId={
              expandedDetailId
            }
            setExpandedDetailId={
              setExpandedDetailId
            }
            onClose={() => {
              setSelectedNotification(
                null
              );

              setGlobalUserView(
                false
              );
            }}
            onNotificationClick={
              handlePopupNotificationClick
            }
            onAccept={
              handleAcceptRequest
            }
            onReject={
              handleRejectRequest
            }
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

/* ============================================================
   LOCAL ANDROID NOTIFICATION
============================================================ */


/* ============================================================
   HTML CLEANER
============================================================ */

function stripHtml(
  value: string
) {
  return value
    .replace(
      /<br\s*\/?>/gi,
      "\n"
    )
    .replace(
      /<[^>]*>/g,
      ""
    )
    .replace(
      /&nbsp;/g,
      " "
    )
    .trim();
}

/* ============================================================
   DEFAULT TITLES
============================================================ */

function getDefaultTitle(
  type?: string
) {
  switch (type) {
    case "chat":
      return "New Message";

    case "friend_request":
      return "New Friend Request";

    case "friend_accepted":
      return "Friend Request Accepted";

    case "feedback":
      return "Feedback Update";

    case "like":
      return "New Like";

    default:
      return "BunkMates";
  }
}

/* ============================================================
   DEFAULT BODY
============================================================ */

function getDefaultBody(
  type?: string
) {
  switch (type) {
    case "chat":
      return "You have a new message.";

    case "friend_request":
      return "Someone sent you a friend request.";

    case "friend_accepted":
      return "Your friend request was accepted.";

    case "feedback":
      return "You have a new feedback update.";

    case "like":
      return "Someone liked your activity.";

    default:
      return "You have a new notification.";
  }
}

/* ============================================================
   FILTER CHIP
============================================================ */

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active &&
          styles.filterChipActive,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          active &&
            styles.filterTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ============================================================
   NOTIFICATION CARD
============================================================ */

function NotificationCard({
  group,
  onPress,
  onMarkRead,
  onDelete,
  onAccept,
  onReject,
}: {
  group: NotificationGroup;
  onPress: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const latest =
    group.notifications[0];

  const count =
    group.notifications.length;

  const unread =
    !group.isSeen;

  const isFriendRequest =
    latest.type ===
    "friend_request";

  return (
    <View
      style={
        styles.cardWrapper
      }
    >
      {unread && (
        <View
          style={
            styles.cardActions
          }
        >
          <Pressable
            onPress={onMarkRead}
            style={
              styles.readAction
            }
          >
            <Ionicons
              name="checkmark"
              size={18}
              color="#69e28c"
            />
          </Pressable>

          <Pressable
            onPress={onDelete}
            style={
              styles.deleteAction
            }
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color="#ff6b6b"
            />
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={onPress}
        style={[
          styles.notificationCard,
          unread &&
            styles.unreadCard,
        ]}
      >
        <NotificationAvatar
          notification={latest}
        />

        <View
          style={
            styles.notificationContent
          }
        >
          <View
            style={
              styles.notificationHeader
            }
          >
            <Text
              numberOfLines={1}
              style={[
                styles.notificationTitle,
                unread &&
                  styles.unreadTitle,
              ]}
            >
              {latest.title ||
                "Notification"}
            </Text>

            <Text
              style={
                styles.notificationTime
              }
            >
              {group.groupTime}
            </Text>
          </View>

          {isFriendRequest ? (
            <View>
              <Text
                numberOfLines={2}
                style={
                  styles.notificationMessage
                }
              >
                {latest.content ||
                  latest.message ||
                  "Friend request"}
              </Text>

              <View
                style={
                  styles.requestButtons
                }
              >
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onAccept();
                  }}
                  style={
                    styles.acceptButton
                  }
                >
                  <Text
                    style={
                      styles.acceptText
                    }
                  >
                    Accept
                  </Text>
                </Pressable>

                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onReject();
                  }}
                  style={
                    styles.rejectButton
                  }
                >
                  <Text
                    style={
                      styles.rejectText
                    }
                  >
                    Reject
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : count > 1 ? (
            <View
              style={
                styles.clusterRow
              }
            >
              <Text
                style={[
                  styles.clusterText,
                  unread &&
                    styles.clusterTextUnread,
                ]}
              >
                {count} alerts in this
                time window
              </Text>

              {unread && (
                <View
                  style={
                    styles.unreadDot
                  }
                />
              )}
            </View>
          ) : (
            <View
              style={
                styles.messageRow
              }
            >
              {unread && (
                <View
                  style={
                    styles.unreadDot
                  }
                />
              )}

              <Text
                numberOfLines={1}
                style={[
                  styles.notificationMessage,
                  unread &&
                    styles.unreadMessage,
                ]}
              >
                {stripHtml(
                  latest.content ||
                    latest.message ||
                    "No details available."
                )}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

/* ============================================================
   DETAIL MODAL
============================================================ */

function NotificationDetail({
  selectedNotification,
  notifications,
  groupedNotifications,
  globalUserView,
  setGlobalUserView,
  expandedDetailId,
  setExpandedDetailId,
  onClose,
  onNotificationClick,
  onAccept,
  onReject,
}: {
  selectedNotification: NotificationItem;

  notifications: NotificationItem[];

  groupedNotifications: Record<
    string,
    NotificationGroup[]
  >;

  globalUserView: boolean;

  setGlobalUserView: (
    value: boolean
  ) => void;

  expandedDetailId: string | null;

  setExpandedDetailId: (
    value: string | null
  ) => void;

  onClose: () => void;

  onNotificationClick: (
    notification: NotificationItem
  ) => void;

  onAccept: (
    notification: NotificationItem
  ) => void;

  onReject: (
    notification: NotificationItem
  ) => void;
}) {
  let displayList: NotificationItem[] =
    [];

  if (globalUserView) {
    displayList =
      notifications.filter(
        (notification) =>
          (
            notification.senderId ||
            "system"
          ) ===
          (
            selectedNotification.senderId ||
            "system"
          )
      );
  } else {
    const parentGroup =
      Object.values(
        groupedNotifications
      )
        .flatMap(
          (groupList) =>
            groupList
        )
        .find((group) =>
          group.notifications.some(
            (notification) =>
              notification.id ===
              selectedNotification.id
          )
        );

    displayList =
      parentGroup
        ? parentGroup.notifications
        : [selectedNotification];
  }

  return (
    <View
      style={
        styles.modalContainer
      }
    >
      <Pressable
        style={
          styles.modalBackdrop
        }
        onPress={onClose}
      />

      <View
        style={
          styles.detailModal
        }
      >
        <View
          style={
            styles.detailHeader
          }
        >
          <View
            style={
              styles.detailHeaderLeft
            }
          >
            <NotificationAvatar
              notification={
                selectedNotification
              }
            />

            <View
              style={
                styles.detailTitleContainer
              }
            >
              <Text
                numberOfLines={2}
                style={
                  styles.detailTitle
                }
              >
                {selectedNotification.title ||
                  "Notification Updates"}
              </Text>

              <Text
                style={
                  styles.detailSender
                }
              >
                {selectedNotification.senderId ===
                "system"
                  ? "System Messages"
                  : `Sender: ${
                      selectedNotification.senderName ||
                      selectedNotification.senderId ||
                      "Unknown"
                    }`}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onClose}
            style={
              styles.closeButton
            }
          >
            <Ionicons
              name="close"
              size={22}
              color="#eeeeee"
            />
          </Pressable>
        </View>

        <View
          style={
            styles.clusterBadgeContainer
          }
        >
          <View
            style={
              styles.clusterBadge
            }
          >
            <Text
              style={
                styles.clusterBadgeText
              }
            >
              {globalUserView
                ? "Showing All History From User"
                : "Showing Current Time Cluster"}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.detailScroll
          }
        >
          {displayList.map(
            (
              notification
            ) => {
              const isRequest =
                notification.type ===
                "friend_request";

              const isChat =
                notification.type ===
                "chat";

              const isExpanded =
                expandedDetailId ===
                notification.id;

              return (
                <Pressable
                  key={
                    notification.id
                  }
                  onPress={() =>
                    onNotificationClick(
                      notification
                    )
                  }
                  style={[
                    styles.detailItem,
                    !notification.seen &&
                      styles.detailItemUnread,
                  ]}
                >
                  {isChat && (
                    <Text
                      style={
                        styles.chatHint
                      }
                    >
                      💬 Chat Message —
                      Click to Reply
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.detailMessage,
                      notification.seen
                        ? styles.detailSeenText
                        : styles.detailUnreadText,
                    ]}
                    numberOfLines={
                      isExpanded ||
                      isRequest
                        ? undefined
                        : 2
                    }
                  >
                    {stripHtml(
                      notification.content ||
                        notification.message ||
                        "No details provided."
                    )}
                  </Text>

                  {isRequest && (
                    <View
                      style={
                        styles.detailRequestButtons
                      }
                    >
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();

                          onAccept(
                            notification
                          );
                        }}
                        style={
                          styles.detailAcceptButton
                        }
                      >
                        <Text
                          style={
                            styles.detailAcceptText
                          }
                        >
                          Accept Request
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();

                          onReject(
                            notification
                          );
                        }}
                        style={
                          styles.detailRejectButton
                        }
                      >
                        <Text
                          style={
                            styles.detailRejectText
                          }
                        >
                          Reject
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  <View
                    style={
                      styles.detailMeta
                    }
                  >
                    <Text
                      style={
                        styles.detailTime
                      }
                    >
                      {formatDateLabel(
                        notification.timestamp
                      )}{" "}
                      •{" "}
                      {formatNotificationTime(
                        notification.timestamp
                      )}
                    </Text>

                    <View
                      style={
                        styles.typeBadge
                      }
                    >
                      <Text
                        style={
                          styles.typeBadgeText
                        }
                      >
                        {capitalize(
                          notification.type ||
                            "general"
                        )}
                      </Text>
                    </View>

                    {!notification.seen && (
                      <View
                        style={
                          styles.newBadge
                        }
                      >
                        <Text
                          style={
                            styles.newBadgeText
                          }
                        >
                          New
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        <View
          style={
            styles.detailFooter
          }
        >
          <Pressable
            onPress={() =>
              setGlobalUserView(
                !globalUserView
              )
            }
            style={
              styles.footerSecondaryButton
            }
          >
            <Text
              numberOfLines={1}
              style={
                styles.footerSecondaryText
              }
            >
              {globalUserView
                ? "Time Cluster View"
                : "View All From User"}
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            style={
              styles.footerCloseButton
            }
          >
            <Text
              style={
                styles.footerCloseText
              }
            >
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080808",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#999999",
    marginTop: 12,
    fontSize: 13,
  },

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    marginLeft: 4,
  },

  filters: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 7,
  },

  filterChip: {
    height: 25,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#454545",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor:
      "transparent",
  },

  filterChipActive: {
    backgroundColor: "#ff9918",
    borderColor: "#ff9918",
  },

  filterText: {
    color: "#dddddd",
    fontSize: 10,
    fontWeight: "600",
  },

  filterTextActive: {
    color: "#111111",
  },

  listContent: {
    paddingHorizontal: 4,
    paddingBottom: 35,
  },

  dateLabel: {
    color: "#bbbbbb",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    letterSpacing: 0.4,
  },

  cardWrapper: {
    position: "relative",
    marginBottom: 7,
  },

  cardActions: {
    position: "absolute",
    right: 7,
    top: 0,
    bottom: 0,
    width: 105,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 7,
  },

  readAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor:
      "rgba(52,211,100,0.16)",
    justifyContent: "center",
    alignItems: "center",
  },

  deleteAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor:
      "rgba(239,68,68,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  notificationCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1c1c1c",
    backgroundColor:
      "rgba(15,15,15,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
  },

  unreadCard: {
    backgroundColor:
      "rgba(70,70,70,0.14)",
    borderColor: "#242424",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#222222",
  },

  systemAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ff9d18",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationContent: {
    flex: 1,
    marginLeft: 11,
    minWidth: 0,
  },

  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  notificationTitle: {
    flex: 1,
    color: "#eeeeee",
    fontSize: 11,
    fontWeight: "600",
    marginRight: 7,
  },

  unreadTitle: {
    fontWeight: "800",
    color: "#ffffff",
  },

  notificationTime: {
    color: "#777777",
    fontSize: 8,
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  notificationMessage: {
    flex: 1,
    color: "#8b8b8b",
    fontSize: 10,
    lineHeight: 15,
  },

  unreadMessage: {
    color: "#bdbdbd",
    fontWeight: "500",
  },

  unreadDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ff9918",
    marginRight: 7,
  },

  clusterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  clusterText: {
    color: "#777777",
    fontSize: 9,
    fontWeight: "600",
  },

  clusterTextUnread: {
    color: "#aaaaaa",
  },

  requestButtons: {
    flexDirection: "row",
    gap: 7,
    marginTop: 8,
  },

  acceptButton: {
    backgroundColor:
      "rgba(34,197,94,0.15)",
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },

  acceptText: {
    color: "#63dd87",
    fontSize: 9,
    fontWeight: "700",
  },

  rejectButton: {
    backgroundColor:
      "rgba(239,68,68,0.12)",
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },

  rejectText: {
    color: "#ff7373",
    fontSize: 9,
    fontWeight: "700",
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 90,
    paddingHorizontal: 35,
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: "#151515",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    color: "#eeeeee",
    fontSize: 16,
    fontWeight: "700",
  },

  emptySubtitle: {
    color: "#777777",
    fontSize: 11,
    textAlign: "center",
    marginTop: 7,
  },

  previewButton: {
    marginTop: 25,
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: "#ff9918",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  previewButtonText: {
    color: "#050505",
    fontSize: 10,
    fontWeight: "800",
  },

  /* ==========================================================
     MODAL
  ========================================================== */

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor:
      "rgba(0,0,0,0.72)",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      "rgba(0,0,0,0.45)",
  },

  detailModal: {
    flex: 1,
    backgroundColor: "#080808",
    overflow: "hidden",
  },

  detailHeader: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor:
      "rgba(255,255,255,0.04)",
  },

  detailHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },

  detailTitleContainer: {
    flex: 1,
    marginLeft: 11,
  },

  detailTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
  },

  detailSender: {
    color: "#777777",
    fontSize: 9,
    marginTop: 4,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  clusterBadgeContainer: {
    paddingHorizontal: 16,
    paddingBottom: 7,
  },

  clusterBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#151515",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  clusterBadgeText: {
    color: "#eeeeee",
    fontSize: 8,
    fontWeight: "700",
  },

  detailScroll: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 150,
  },

  detailItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 17,
    marginBottom: 8,
    backgroundColor:
      "rgba(15,15,15,0.8)",
    borderWidth: 1,
    borderColor: "#1c1c1c",
  },

  detailItemUnread: {
    backgroundColor:
      "rgba(80,80,80,0.15)",
  },

  chatHint: {
    color: "#ff9d18",
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 7,
  },

  detailMessage: {
    color: "#dddddd",
    fontSize: 12,
    lineHeight: 18,
  },

  detailSeenText: {
    fontWeight: "500",
  },

  detailUnreadText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  detailRequestButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  detailAcceptButton: {
    backgroundColor: "#20a957",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  detailAcceptText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },

  detailRejectButton: {
    borderWidth: 1,
    borderColor: "#c94a4a",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  detailRejectText: {
    color: "#ff7777",
    fontSize: 10,
    fontWeight: "700",
  },

  detailMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 9,
    flexWrap: "wrap",
  },

  detailTime: {
    color: "#666666",
    fontSize: 8,
  },

  typeBadge: {
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  typeBadgeText: {
    color: "#888888",
    fontSize: 7,
    fontWeight: "600",
  },

  newBadge: {
    backgroundColor: "#ff9918",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  newBadgeText: {
    color: "#111111",
    fontSize: 7,
    fontWeight: "800",
  },

  detailFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 25,
    flexDirection: "row",
    gap: 8,
    backgroundColor:
      "rgba(8,8,8,0.96)",
    borderTopWidth: 1,
    borderTopColor:
      "rgba(255,255,255,0.04)",
  },

  footerSecondaryButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 22,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  footerSecondaryText: {
    color: "#eeeeee",
    fontSize: 10,
    fontWeight: "700",
  },

  footerCloseButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 22,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
  },

  footerCloseText: {
    color: "#eeeeee",
    fontSize: 10,
    fontWeight: "700",
  },
});
