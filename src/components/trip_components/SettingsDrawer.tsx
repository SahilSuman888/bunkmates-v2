import React from "react";
import {
View,
Text,
Modal,
TouchableOpacity,
StyleSheet,
ScrollView,
} from "react-native";
import { BlurView } from "../ui/AppBlurView";
import Slider from "@react-native-community/slider";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/* ---------------- Types ---------------- */

interface Member {
uid: string;
}

interface Trip {
name?: string;
location?: string;
startDate?: string;
endDate?: string;
from?: string;
to?: string;
createdBy?: string;
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
updatePermissions: (p: any) => void;
promoteToAdmin: (uid: string) => void;
demoteAdmin: (uid: string) => void;
mode: "light" | "dark";
setConfirmDeleteOpen: (v: boolean) => void;
getMemberName: (uid?: string) => string;
currentUseruid: string;
displaySettings: DisplaySettings;
updateDisplaySettings: (val: Partial<DisplaySettings>) => void;
}

/* ---------------- Component ---------------- */

const SettingsDrawer: React.FC<Props> = ({
settingsDrawerOpen,
setSettingsDrawerOpen,
trip,
tripAdmins,
memberDetails,
tripPermissions,
updatePermissions,
promoteToAdmin,
demoteAdmin,
mode,
setConfirmDeleteOpen,
getMemberName,
currentUseruid,
displaySettings,
updateDisplaySettings,
}) => {

const isDark = mode === "dark";

/* SAFE FALLBACKS */

const admins = tripAdmins ?? [];
const members = memberDetails ?? [];
const permissions = tripPermissions ?? {};

/* ADMIN CHECK */

const isAdmin = admins.includes(currentUseruid);

/* GLASS STYLE */

const glassCard = {
borderRadius: 16,
padding: 16,
backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#fff",
borderWidth: 1,
borderColor: isDark
? "rgba(255,255,255,0.08)"
: "rgba(0,0,0,0.06)",
};

return (

<Modal
visible={settingsDrawerOpen}
animationType="slide"
transparent
onRequestClose={() => setSettingsDrawerOpen(false)}

>

<BlurView
intensity={40}
tint={isDark ? "dark" : "light"}
style={styles.backdrop}

>

<TouchableOpacity
style={{ flex: 1 }}
onPress={() => setSettingsDrawerOpen(false)}
/>

</BlurView>

<View
style={[
styles.drawer,
{
backgroundColor: isDark ? "#000" : "#f7f7f7",
},
]}

>

<View style={styles.handle} />

{/* HEADER */}

<View style={styles.header}>

<Text
style={[
styles.headerText,
{ color: isDark ? "#fff" : "#000" },
]}

>

{isAdmin ? "Trip Settings" : "Trip Info"} </Text>

<TouchableOpacity
onPress={() => setSettingsDrawerOpen(false)}

>

<MaterialCommunityIcons
name="close"
size={22}
color={isDark ? "#fff" : "#000"}
/>

</TouchableOpacity>

</View>

<ScrollView showsVerticalScrollIndicator={false}>

{/* TRIP INFO */}

<View style={glassCard}>

<Text style={styles.sectionTitle}>
Trip Info
</Text>

<InfoRow label="Name" value={trip?.name} />

<InfoRow label="Location" value={trip?.location} />

<InfoRow
label="Created By"
value={getMemberName(trip?.createdBy)}
/>

<InfoRow
label="Members"
value={String(members.length)}
/>

</View>

{/* PERMISSIONS */}

{isAdmin && Object.keys(permissions).length > 0 && (

<View style={[glassCard, { marginTop: 16 }]}>

<Text style={styles.sectionTitle}>
Permissions
</Text>

{Object.keys(permissions).map((perm) => (

<View key={perm} style={{ marginTop: 12 }}>

<Text style={styles.caption}>
{perm}
</Text>

<View style={styles.row}>

{["all", "admins"].map((type) => (

<TouchableOpacity
key={type}
style={[
styles.toggleButton,
{
backgroundColor:
permissions[perm] === type
? "#000"
: "transparent",
},
]}
onPress={() =>
updatePermissions({
...permissions,
[perm]: type,
})
}

>

<Text
style={{
color:
permissions[perm] === type
? "#fff"
: "#000",
}}

>

{type === "all"
? "Everyone"
: "Admins"} </Text>

</TouchableOpacity>

))}

</View>

</View>

))}

</View>

)}

{/* ADMIN MANAGEMENT */}

{isAdmin && (

<View style={[glassCard, { marginTop: 16 }]}>

<Text style={styles.sectionTitle}>
Manage Admins
</Text>

{members.map((user) => {

const isTripAdmin = admins.includes(user.uid);

return (

<View
key={user.uid}
style={styles.adminRow}

>

<Text>
{getMemberName(user.uid)}
</Text>

{isTripAdmin ? (

<TouchableOpacity
onPress={() =>
demoteAdmin(user.uid)
}

>

<Text style={{ color: "orange" }}>
Demote </Text>

</TouchableOpacity>

) : (

<TouchableOpacity
onPress={() =>
promoteToAdmin(user.uid)
}

>

<Text>
Promote
</Text>

</TouchableOpacity>

)}

</View>

);

})}

</View>

)}

{/* DISPLAY SETTINGS */}

{isAdmin && displaySettings && (

<View style={[glassCard, { marginTop: 16 }]}>

<Text style={styles.sectionTitle}>
Display
</Text>

<Text style={styles.caption}>
Layout
</Text>

<View style={styles.row}>

{["grid", "list"].map((type) => (

<TouchableOpacity
key={type}
style={[
styles.toggleButton,
{
backgroundColor:
displaySettings.layout === type
? "#000"
: "transparent",
},
]}
onPress={() =>
updateDisplaySettings({
layout: type as any,
})
}

>

<Text
style={{
color:
displaySettings.layout === type
? "#fff"
: "#000",
textTransform: "capitalize",
}}

>

{type} </Text>

</TouchableOpacity>

))}

</View>

<Text style={styles.caption}>
Grid Columns
</Text>

<Slider
minimumValue={1}
maximumValue={6}
step={1}
value={displaySettings.gridCols ?? 2}
onValueChange={(v) =>
updateDisplaySettings({ gridCols: v })
}
/>

</View>

)}

{/* DANGER ZONE */}

{isAdmin && (

<View
style={[
glassCard,
{
marginTop: 16,
borderColor: "rgba(255,0,0,0.4)",
},
]}

>

<Text
style={[
styles.sectionTitle,
{ color: "red" },
]}

>

Danger Zone </Text>

<TouchableOpacity
style={styles.deleteButton}
onPress={() => {
setSettingsDrawerOpen(false);
setConfirmDeleteOpen(true);
}}

>

<MaterialCommunityIcons
name="delete-outline"
size={18}
color="red"
/>

<Text
style={{
color: "red",
marginLeft: 6,
}}

>

Delete Trip </Text>

</TouchableOpacity>

</View>

)}

</ScrollView>

</View>

</Modal>

);
};

/* ---------------- INFO ROW ---------------- */

const InfoRow = ({
label,
value,
}: {
label: string;
value?: string;
}) => (

<View style={styles.infoRow}>

<Text style={styles.caption}>
{label}
</Text>

<Text>
{value || "—"}
</Text>

</View>

);

export default SettingsDrawer;

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({

backdrop: {
...StyleSheet.absoluteFillObject,
},

drawer: {
position: "absolute",
bottom: 0,
width: "100%",
borderTopLeftRadius: 28,
borderTopRightRadius: 28,
padding: 20,
maxHeight: "90%",
},

handle: {
width: 42,
height: 5,
borderRadius: 3,
backgroundColor: "#aaa",
alignSelf: "center",
marginBottom: 12,
},

header: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 10,
},

headerText: {
fontSize: 18,
fontWeight: "700",
},

sectionTitle: {
fontWeight: "600",
marginBottom: 10,
},

caption: {
fontSize: 12,
color: "#666",
},

row: {
flexDirection: "row",
gap: 10,
marginTop: 8,
},

toggleButton: {
padding: 8,
borderRadius: 8,
borderWidth: 1,
borderColor: "#ccc",
},

adminRow: {
flexDirection: "row",
justifyContent: "space-between",
marginTop: 8,
},

infoRow: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 6,
},

deleteButton: {
flexDirection: "row",
alignItems: "center",
marginTop: 10,
},

});
