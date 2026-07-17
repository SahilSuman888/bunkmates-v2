import React from 'react';
import { View } from 'react-native';
import Chatroom from './Chatroom';

type Props = { route: any; navigation: any };

const GroupChat: React.FC<Props> = ({ route, navigation }) => {
  return (
    <View style={{ flex: 1 }}>
      <Chatroom route={route} navigation={navigation} />
    </View>
  );
};

export default GroupChat;
