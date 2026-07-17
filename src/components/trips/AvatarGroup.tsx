import React from "react";
import { View, Image, StyleSheet } from "react-native";

interface Props {
  members: any[];
}

export default function AvatarGroup({ members }: Props) {
  return (
    <View style={styles.container}>
      {members.slice(0, 3).map((m, index) => (
        <Image
          key={m.uid || index}
          source={{
            uri:
              m.photoURL ||
              `https://api.dicebear.com/7.x/identicon/png?seed=${m.uid}`,
          }}
          style={[
            styles.avatar,
            { marginLeft: index === 0 ? 0 : -10 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#000",
  },
});