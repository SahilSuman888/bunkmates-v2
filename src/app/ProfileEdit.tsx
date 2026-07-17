import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../contexts/UserContext";
import { auth, db, storage } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function EditProfile() {
  const router = useRouter();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<any>({
    name: "",
    username: "",
    email: "",
    mobile: "",
    bio: "",
    photoURL: "",
  });

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (snap.exists()) {
          const firestoreData = snap.data();

          setData({
            name: firestoreData.name || user.displayName || "",
            username: firestoreData.username || "",
            email: user.email || "",
            mobile: firestoreData.mobile || "",
            bio: firestoreData.bio || "",
            photoURL:
              firestoreData.photoURL ||
              user.photoURL ||
              "",
          });
        }
      } catch (e) {
        console.log("Load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ✅ Image Picker
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setData({ ...data, photoURL: result.assets[0].uri });
    }
  };

  // ✅ Save Handler
const handleSave = async () => {
  if (!user || saving) return;

  try {
    setSaving(true);

    let finalPhotoURL = data.photoURL;

    // 🚀 If it's NOT already a Firebase URL → upload it
    if (finalPhotoURL && !finalPhotoURL.startsWith("http")) {
      let blob: Blob | null = null;
      try {
        // Preferred: use fetch to get a Blob (works in most environments)
        const resp = await fetch(finalPhotoURL);
        blob = await resp.blob();
      } catch (fetchErr) {
        // Fallback: try XMLHttpRequest for environments where fetch(file://) fails
        try {
          blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
              resolve(xhr.response);
            };
            xhr.onerror = function () {
              reject(new TypeError("Network request failed"));
            };
            xhr.responseType = "blob";
            xhr.open("GET", finalPhotoURL, true);
            xhr.send(null);
          });
        } catch (xhrErr) {
          console.log("Upload conversion failed:", fetchErr, xhrErr);
          throw xhrErr || fetchErr;
        }
      }

      if (blob) {
        const storageRef = ref(storage, `profileImages/${user.uid}.jpg`);
        await uploadBytes(storageRef, blob as any);
        finalPhotoURL = await getDownloadURL(storageRef);
      }
    }

    // ✅ Update Firestore
    await updateDoc(doc(db, "users", user.uid), {
      name: data.name,
      username: data.username,
      mobile: data.mobile,
      bio: data.bio,
      photoURL: finalPhotoURL,
      updatedAt: new Date(),
    });

    // ✅ Update Firebase Auth (ONLY valid URL now)
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: data.name,
        photoURL: finalPhotoURL,
      });
    }

    router.back();
  } catch (e) {
    console.log("Save error:", e);
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#ff7a3d" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#000000", "#0a0f1c", "#0c1b2a"]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Edit Profile</Text>

          {/* Avatar */}
          <Pressable onPress={pickImage} style={styles.avatarWrapper}>
            <Image
              source={{
                uri:
                  data.photoURL ||
                  "https://i.pravatar.cc/150?img=12",
              }}
              style={styles.avatar}
            />
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={18} color="#fff" />
            </View>
          </Pressable>

          <Input
            label="Full Name"
            value={data.name}
            onChange={(v: string) =>
              setData({ ...data, name: v })
            }
          />

          <Input
            label="Username"
            value={data.username}
            onChange={(v: string) =>
              setData({ ...data, username: v })
            }
          />

          <Input
            label="Email"
            value={data.email}
            editable={false}
          />

          <Input
            label="Mobile Number"
            value={data.mobile}
            onChange={(v: string) =>
              setData({ ...data, mobile: v })
            }
          />

          <Input
            label="Bio"
            value={data.bio}
            onChange={(v: string) =>
              setData({ ...data, bio: v })
            }
            multiline
            height={100}
          />

          <View style={styles.buttonRow}>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.saveBtn,
                saving && { opacity: 0.6 },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.saveText}>
                  Save Changes
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const Input = ({
  label,
  value,
  onChange,
  editable = true,
  multiline = false,
  height = 60,
}: any) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      editable={editable}
      multiline={multiline}
      style={[
        styles.input,
        { height },
        !editable && { opacity: 0.6 },
      ]}
      placeholderTextColor="#888"
    />
  </View>
);

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 25,
  },

  avatarWrapper: {
    alignSelf: "center",
    marginBottom: 30,
  },

  avatar: {
    width: 140,
    height: 140,
    borderRadius: 35,
  },

  cameraIcon: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 6,
    borderRadius: 20,
  },

  label: {
    color: "#bbb",
    marginBottom: 6,
    fontSize: 12,
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    paddingHorizontal: 15,
    color: "#fff",
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  cancelBtn: {
    borderWidth: 1,
    borderColor: "#ff7a3d",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
  },

  cancelText: {
    color: "#ff7a3d",
    fontWeight: "600",
  },

  saveBtn: {
    backgroundColor: "#ff7a3d",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
  },

  saveText: {
    fontWeight: "600",
    color: "#000",
  },
});