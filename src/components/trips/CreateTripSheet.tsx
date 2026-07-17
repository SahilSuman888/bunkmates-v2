import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
} from "react-native";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons"; // Ensure expo/vector-icons is installed
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth } from "../../lib/firebase";
import DateTimePicker from "@react-native-community/datetimepicker";

const { height, width } = Dimensions.get("window");

export default function CreateTripSheet({ visible, onClose, initialPlace }: any) {
  const user = auth.currentUser;

  const [step, setStep] = useState(1); // Starting at 1 to match UI
  const [trip, setTrip] = useState({
    name: "",
    from: "",
    to: "",
    location: "",
    startDate: null,
    endDate: null,
    iconURL: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?q=80&w=300&auto=format&fit=crop", // Default nature placeholder
  });

  const [members, setMembers] = useState([]);
  const [friendSuggestions, setFriendSuggestions] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [totalBudget, setTotalBudget] = useState(0);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateTarget, setDateTarget] = useState(null);

  // Initialize with creator
  useEffect(() => {
    if (user && visible) {
      setMembers([
        {
          uid: user.uid,
          name: user.displayName || "You",
          photoURL: user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=creator",
          username: user.email?.split("@")[0] || "me",
          contribution: 0,
        },
      ]);
    }
  }, [user, visible]);

  // Prefill from initialPlace if provided
  useEffect(() => {
    if (visible && initialPlace) {
      setTrip((t) => ({
        ...t,
        name: initialPlace.name + " Trip",
        location: initialPlace.name,
        from: "",
        to: initialPlace.name,
        iconURL: initialPlace.images && initialPlace.images[0] ? initialPlace.images[0] : t.iconURL,
      }));
    }
  }, [visible, initialPlace]);

  // Fetch Friends Logic: read current user's doc, iterate friend UIDs and fetch their profiles
  useEffect(() => {
    const fetchFriends = async () => {
      if (!user) return;
      try {
        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        const friends = userDocSnap.exists() ? userDocSnap.data()?.friends || [] : [];
        if (!friends || friends.length === 0) {
          setFriendSuggestions([]);
          return;
        }

        // Fetch each friend document by UID (doc id) to avoid relying on a 'uid' field
        const results = [];
        // limit to first 50 friends to avoid long waits
        const slice = friends.slice(0, 50);
        for (const fid of slice) {
          try {
            const fSnap = await getDoc(doc(db, "users", fid));
            if (!fSnap.exists()) continue;
            const data = fSnap.data();
            results.push({
              uid: fid,
              name: data.name || data.displayName || data.email?.split("@")[0] || "Unknown",
              photoURL: data.photoURL || `https://api.dicebear.com/7.x/identicon/png?seed=${fid}`,
              username: data.username || data.email?.split("@")[0] || fid.substring(0, 8),
            });
          } catch (err) {
            console.log("failed to fetch friend", fid, err);
          }
        }
        setFriendSuggestions(results);
      } catch (e) {
        console.log(e);
      }
    };
    if (visible) fetchFriends();
  }, [user, visible]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return alert("Permission required to access photos.");

    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;

    const uri = res.assets[0].uri;

    try {
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      const maxSize = 250 * 1024; // 250 KB
      if (info.size && info.size > maxSize) {
        alert("File size too large! Please select an image under 250KB.");
        return;
      }

      // read base64 and store as data URI
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const mime = "image/jpeg";
      const dataUri = `data:${mime};base64,${base64}`;
      setTrip({ ...trip, iconURL: dataUri });
    } catch (e) {
      console.log("pickImage error", e);
      // fallback to uri
      setTrip({ ...trip, iconURL: uri });
    }
  };

  const handleAddFriend = (f) => {
    if (members.find((m) => m.uid === f.uid)) return;
    setMembers((prev) => [...prev, { ...f, contribution: 0 }]);
  };

  const handleRemoveMember = (uid) => {
    if (uid === user?.uid) return;
    setMembers(members.filter((m) => m.uid !== uid));
  };

  const handleContributionChange = (uid, val) => {
    const numVal = parseInt(val) || 0;
    const updated = members.map((m) => m.uid === uid ? { ...m, contribution: numVal } : m);
    setMembers(updated);
    setTotalBudget(updated.reduce((acc, m) => acc + (m.contribution || 0), 0));
  };

  const handleCreate = async () => {
    if (!user) return;
    try {
      // handle image: if it's a data URI (base64) we can store it directly in Firestore
      let iconURL = trip.iconURL;
      if (typeof iconURL === 'string' && iconURL.startsWith('data:image')) {
        // store data URI directly in Firestore (keeps inline image for small images)
      } else if (iconURL && iconURL.startsWith("file://")) {
        const storage = getStorage();
        const resp = await fetch(iconURL);
        const blob = await resp.blob();
        const storageRef = ref(storage, `trips/${user.uid}/${Date.now()}`);
        await uploadBytes(storageRef, blob);
        iconURL = await getDownloadURL(storageRef);
      }

      const tripDoc = await addDoc(collection(db, "trips"), {
        name: trip.name || "Untitled Trip",
        from: trip.from || null,
        to: trip.to || null,
        location: trip.location || null,
        startDate: trip.startDate || null,
        endDate: trip.endDate || null,
        iconURL: iconURL || null,
        places: initialPlace ? [initialPlace.placeId] : [],
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        members: members.map((m) => m.uid),
      });

      // Also create a groupChats doc referencing this trip for chat/icon usage
      try {
        await setDoc(doc(collection(db, "groupChats")), {
          tripId: tripDoc.id,
          name: trip.name || "",
          iconURL: iconURL || null,
          members: members.map((m) => m.uid),
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.log("failed to create groupChat", e);
      }

      onClose();
    } catch (e) {
      console.log("create trip failed", e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Create a trip</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* PROGRESS STEPPER */}
          <View style={styles.stepperContainer}>
            <View style={styles.stepWrapper}>
              <View style={[styles.stepCircle, step >= 1 && styles.stepActive]}>
                {step > 1 ? <Ionicons name="checkmark" size={16} color="white" /> : <Text style={styles.stepNum}>1</Text>}
              </View>
              <Text style={[styles.stepLabel, step >= 1 && styles.textActive]}>Trip Details</Text>
            </View>
            <View style={[styles.stepLine, step > 1 && styles.lineActive]} />
            <View style={styles.stepWrapper}>
              <View style={[styles.stepCircle, step === 2 && styles.stepActive]}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <Text style={[styles.stepLabel, step === 2 && styles.textActive]}>Add Members</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {step === 1 ? (
              <View>
                <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
                  <Image source={{ uri: trip.iconURL }} style={styles.mainImage} />
                  <View style={styles.cameraIcon}>
                    <Ionicons name="camera" size={20} color="white" />
                  </View>
                </TouchableOpacity>

                <TextInput placeholder="Trip Name" placeholderTextColor="#888" style={styles.input} onChangeText={(v) => setTrip({ ...trip, name: v })} />
                <TextInput placeholder="From" placeholderTextColor="#888" style={styles.input} onChangeText={(v) => setTrip({ ...trip, from: v })} />
                <TextInput placeholder="To" placeholderTextColor="#888" style={styles.input} onChangeText={(v) => setTrip({ ...trip, to: v })} />
                <TextInput placeholder="Route/Location" placeholderTextColor="#888" style={styles.input} onChangeText={(v) => setTrip({ ...trip, location: v })} />

                <View style={styles.dateRow}>
                  <TouchableOpacity style={styles.dateInput} onPress={() => { setDateTarget("start"); setShowDatePicker(true); }}>
                    <Text style={styles.dateLabel}>Start Date</Text>
                    <View style={styles.dateValueRow}>
                        <Text style={styles.dateText}>{trip.startDate || "dd-mm-yyyy"}</Text>
                        <Ionicons name="calendar-outline" size={16} color="#888" />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dateInput} onPress={() => { setDateTarget("end"); setShowDatePicker(true); }}>
                    <Text style={styles.dateLabel}>End Date</Text>
                    <View style={styles.dateValueRow}>
                        <Text style={styles.dateText}>{trip.endDate || "dd-mm-yyyy"}</Text>
                        <Ionicons name="calendar-outline" size={16} color="#888" />
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.footerRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
                    <Text style={styles.nextText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.searchContainer}>
                  <TextInput
                    placeholder="Search user by username or email"
                    placeholderTextColor="#888"
                    style={styles.searchInput}
                    value={memberSearch}
                    onChangeText={setMemberSearch}
                  />
                </View>

                <Text style={styles.sectionTitle}>Your Friends</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendsList}>
                  {friendSuggestions.map((f) => (
                    <View key={f.uid} style={styles.friendCard}>
                      <Image source={{ uri: f.photoURL }} style={styles.friendAvatar} />
                      <Text style={styles.friendName}>{f.name}</Text>
                      <Text style={styles.friendUser}>@{f.username}</Text>
                      <TouchableOpacity style={styles.addBtnSmall} onPress={() => handleAddFriend(f)}>
                        <Text style={styles.addBtnText}>+ ADD</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.selectedChips}>
                  {members.map((m) => (
                    <View key={m.uid} style={styles.chip}>
                      <Image source={{ uri: m.photoURL }} style={styles.chipAvatar} />
                      <Text style={styles.chipText}>{m.name}</Text>
                      <TouchableOpacity onPress={() => handleRemoveMember(m.uid)}>
                        <Ionicons name="close-circle" size={18} color="#888" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {members.map((m) => (
                    <View key={m.uid} style={styles.memberListItem}>
                        <Image source={{ uri: m.photoURL }} style={styles.listAvatar} />
                        <View style={{flex: 1}}>
                            <Text style={styles.memberName}>{m.name}</Text>
                            <Text style={styles.friendUser}>@{m.username}</Text>
                        </View>
                        <TextInput 
                            placeholder="Contri..." 
                            placeholderTextColor="#555"
                            keyboardType="numeric"
                            onChangeText={(v) => handleContributionChange(m.uid, v)}
                            style={styles.contriInput}
                        />
                    </View>
                ))}

                <View style={styles.budgetContainer}>
                   <Text style={styles.totalLabel}>Total Budget:</Text>
                   <View style={styles.budgetBadge}>
                       <Text style={styles.budgetAmount}>₹{totalBudget}</Text>
                   </View>
                </View>

                <View style={styles.footerRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep(1)}>
                    <Text style={styles.cancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={handleCreate}>
                    <Text style={styles.nextText}>Create Trip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {showDatePicker && (
            <DateTimePicker
              value={new Date()}
              mode="date"
              onChange={(e, d) => {
                setShowDatePicker(false);
                if (d) {
                  const formatted = d.toISOString().split('T')[0];
                  setTrip({ ...trip, [dateTarget === "start" ? "startDate" : "endDate"]: formatted });
                }
              }}
            />
          )}
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "flex-end" },
  content: { height: height * 0.92, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, backgroundColor: "#121212" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 30 },
  title: { fontSize: 24, fontWeight: "bold", color: "white" },
  
  // Stepper
  stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 30, backgroundColor: "#1e1e1e", padding: 15, borderRadius: 20 },
  stepWrapper: { alignItems: "center", flexDirection: 'row' },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#333", justifyContent: "center", alignItems: "center", marginRight: 8 },
  stepActive: { backgroundColor: "#4CAF50" },
  stepNum: { color: "white", fontSize: 12, fontWeight: "bold" },
  stepLabel: { color: "#666", fontSize: 13 },
  textActive: { color: "white" },
  stepLine: { width: 40, height: 1, backgroundColor: "#333", marginHorizontal: 15 },
  lineActive: { backgroundColor: "#4CAF50" },

  // Form
  imageContainer: { alignSelf: "center", width: 180, height: 180, borderRadius: 25, overflow: "hidden", marginBottom: 25 },
  mainImage: { width: "100%", height: "100%" },
  cameraIcon: { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 10 },
  input: { backgroundColor: "#1e1e1e", color: "white", padding: 16, borderRadius: 15, marginBottom: 12, borderHighlight: '#333', borderWidth: 1, borderColor: '#2a2a2a' },
  
  dateRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  dateInput: { backgroundColor: "#1e1e1e", width: "48%", padding: 10, borderRadius: 15, borderWidth: 1, borderColor: '#2a2a2a' },
  dateLabel: { color: "#666", fontSize: 11, marginBottom: 4 },
  dateValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { color: "white", fontSize: 14, fontWeight: '500' },

  // Step 2
  searchInput: { backgroundColor: "#1e1e1e", color: "white", padding: 15, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  sectionTitle: { color: "white", fontSize: 16, fontWeight: "600", marginBottom: 15 },
  friendsList: { flexDirection: "row", marginBottom: 20 },
  friendCard: { backgroundColor: "#1e1e1e", padding: 15, borderRadius: 20, alignItems: "center", width: 130, marginRight: 12 },
  friendAvatar: { width: 60, height: 60, borderRadius: 30, marginBottom: 10 },
  friendName: { color: "white", fontWeight: "bold", fontSize: 14 },
  friendUser: { color: "#777", fontSize: 11, marginBottom: 10 },
  addBtnSmall: { backgroundColor: "white", paddingVertical: 6, paddingHorizontal: 15, borderRadius: 10 },
  addBtnText: { color: "black", fontSize: 11, fontWeight: "bold" },

  selectedChips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e1e1e", padding: 5, paddingRight: 10, borderRadius: 20, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  chipAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  chipText: { color: "white", fontSize: 12, marginRight: 5 },

  memberListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 12, borderRadius: 15, marginBottom: 10 },
  listAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  memberName: { color: 'white', fontWeight: '600' },
  contriInput: { backgroundColor: '#121212', color: 'white', padding: 8, borderRadius: 10, width: 80, textAlign: 'center', fontSize: 12, borderWidth: 1, borderColor: '#333' },

  budgetContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 25 },
  totalLabel: { color: 'white', fontSize: 18, marginRight: 10 },
  budgetBadge: { backgroundColor: '#1e1e1e', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  budgetAmount: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  // Buttons
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  cancelBtn: { width: "48%", padding: 16, borderRadius: 25, borderWidth: 1, borderColor: "white", alignItems: "center" },
  cancelText: { color: "white", fontWeight: "bold" },
  nextBtn: { width: "48%", padding: 16, borderRadius: 25, backgroundColor: "white", alignItems: "center" },
  nextText: { color: "black", fontWeight: "bold" },
});