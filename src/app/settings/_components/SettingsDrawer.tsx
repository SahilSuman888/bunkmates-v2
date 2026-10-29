import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons, Feather } from "@expo/vector-icons";
import { SwipeableDrawer } from "./SwipeableDrawer";

/* ---------------- Types ---------------- */

interface Member {
  uid: string;
  name?: string;
  email?: string;
  photoURL?: string;
}

interface Trip {
  id?: string;
  name?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  from?: string;
  to?: string;
  createdBy?: string;
  members?: string[];
}

interface DisplaySettings {
  layout: "grid" | "list";
  gridCols: number;
  listCols: number;
  cardType: "regular" | "detailed";
}

interface Props {
  settingsDrawerOpen: boolean;
  setSettingsDrawerOpen: (v: boolean) => void;
  trip?: Trip;
  tripAdmins?: string[];
  memberDetails?: Member[];
  tripPermissions?: Record<string, "all" | "admins">;
  updatePermissions?: (p: any) => void;
  promoteToAdmin?: (uid: string) => void;
  demoteAdmin?: (uid: string) => void;
  mode?: "light" | "dark";
  setConfirmDeleteOpen?: (v: boolean) => void;
  getMemberName?: (uid?: string) => string;
  currentUseruid?: string;
  displaySettings?: DisplaySettings;
  updateDisplaySettings?: (val: Partial<DisplaySettings>) => void;
}

const formatDates = (start?: string, end?: string): string => {
  if (!start) return "Thu Apr 02 2026 → Tue Apr 07 2026";
  try {
    const s = new Date(start);
    const e = end ? new Date(end) : s;
    const sStr = s.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
    const eStr = e.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
    return `${sStr} → ${eStr}`;
  } catch {
    return `${start} → ${end || start}`;
  }
};

const SettingsDrawer: React.FC<Props> = ({
  settingsDrawerOpen,
  setSettingsDrawerOpen,
  trip,
  tripAdmins,
  memberDetails = [],
  tripPermissions = {},
  updatePermissions,
  setConfirmDeleteOpen,
  getMemberName,
  currentUseruid,
}) => {
  const admins = tripAdmins ?? [];
  const isAdmin = currentUseruid ? admins.includes(currentUseruid) : false;

  const routeFrom = trip?.from ? trip.from.split(",")[0].trim() : "Jaipur";
  const routeTo = trip?.to
    ? trip.to.split(",")[0].trim()
    : trip?.location
    ? trip.location.split(",")[0].trim()
    : "Dehradun";
  const routeText = `${routeFrom} → ${routeTo}`;

  const createdByName =
    (getMemberName && trip?.createdBy && getMemberName(trip.createdBy)) ||
    "Mohit Sharma (Me)";

  const membersCount =
    memberDetails.length > 0
      ? memberDetails.length
      : trip?.members?.length || 5;

  return (
    <SwipeableDrawer
      visible={settingsDrawerOpen}
      onClose={() => setSettingsDrawerOpen(false)}
      showHandle={true}
      handleColor="rgba(255, 255, 255, 0.28)"
      sheetStyle={styles.drawer}
      backdropColor="rgba(0, 0, 0, 0.7)"
    >
      {/* Header Row: Trip Info + Close Button (Matching Image 3) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trip Info</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => setSettingsDrawerOpen(false)}
          hitSlop={12}
        >
          <Ionicons name="close" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Glossy Trip Info Card (Exact match to Image 3) */}
        <View style={styles.glossyInfoCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="information-circle-outline" size={19} color="#ffffff" />
            <Text style={styles.cardHeaderTitle}>Trip Info</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{trip?.name || "Bunk1"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{trip?.location || trip?.to || "Jaipur"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dates</Text>
            <Text style={styles.infoValue}>
              {formatDates(trip?.startDate, trip?.endDate)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Route</Text>
            <Text style={styles.infoValue}>{routeText}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created by</Text>
            <Text style={styles.infoValue}>{createdByName}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Members</Text>
            <Text style={styles.infoValue}>{membersCount}</Text>
          </View>
        </View>

        {/* Optional Admin Controls (if admin) */}
        {isAdmin && Object.keys(tripPermissions).length > 0 && (
          <View style={[styles.glossyInfoCard, { marginTop: 16 }]}>
            <Text style={styles.cardHeaderTitle}>Permissions</Text>
            {Object.keys(tripPermissions).map((perm) => (
              <View key={perm} style={{ marginTop: 12 }}>
                <Text style={styles.captionText}>{perm}</Text>
                <View style={styles.selectorColumn}>
                  {["all", "admins"].map((type) => {
                    const isSelected = tripPermissions[perm] === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.selectorItem,
                          isSelected && styles.selectorItemActive,
                        ]}
                        onPress={() =>
                          updatePermissions &&
                          updatePermissions({
                            ...tripPermissions,
                            [perm]: type,
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.selectorText,
                            isSelected && styles.selectorTextActive,
                          ]}
                        >
                          {type === "all" ? "Everyone" : "Admins"}
                        </Text>
                        {isSelected && (
                          <Feather name="check" size={18} color="#38bdf8" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {isAdmin && setConfirmDeleteOpen && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => {
              setSettingsDrawerOpen(false);
              setConfirmDeleteOpen(true);
            }}
          >
            <Ionicons name="trash-outline" size={17} color="#ef4444" />
            <Text style={styles.deleteBtnText}>Delete Trip</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SwipeableDrawer>
  );
};

export default SettingsDrawer;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  drawer: {
    backgroundColor: "rgba(18, 22, 32, 0.96)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 4,
  },
  glossyInfoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 18,
    marginTop: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  cardHeaderTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  infoLabel: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 13.5,
    width: 90,
  },
  infoValue: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  captionText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginBottom: 6,
  },
  selectorColumn: {
    width: "100%",
    gap: 8,
    marginTop: 6,
  },
  selectorItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectorItemActive: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  selectorText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.75)",
  },
  selectorTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 16,
    height: 48,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  deleteBtnText: {
    color: "#ef4444",
    fontSize: 13.5,
    fontWeight: "700",
  },
});
