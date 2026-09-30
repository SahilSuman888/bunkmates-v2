import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { checkPasswordRules } from '../../constants/authTheme';

interface PasswordCriteriaGridProps {
  password: string;
}

interface CriterionBadgeProps {
  label: string;
  met: boolean;
}

const CriterionBadge: React.FC<CriterionBadgeProps> = ({ label, met }) => {
  return (
    <View style={styles.item}>
      <Animated.View
        key={met ? 'checked' : 'unchecked'}
        entering={
          met
            ? FadeIn.duration(220)
            : undefined
        }
      >
        <Ionicons
          name={met ? 'checkmark-circle' : 'ellipse-outline'}
          size={14}
          color={met ? '#4ade80' : 'rgba(255, 255, 255, 0.35)'}
          style={styles.icon}
        />
      </Animated.View>
      <Text
        style={[
          styles.label,
          { color: met ? '#4ade80' : 'rgba(255, 255, 255, 0.5)' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

export const PasswordCriteriaGrid: React.FC<PasswordCriteriaGridProps> = ({ password }) => {
  if (!password) return null;

  const rules = checkPasswordRules(password);

  const criteria = [
    { label: '8+ characters', met: rules.length },
    { label: '1 uppercase letter', met: rules.uppercase },
    { label: '1 number', met: rules.number },
    { label: '1 symbol', met: rules.symbol },
  ];

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      <View style={styles.grid}>
        {criteria.map((item, index) => (
          <CriterionBadge key={index} label={item.label} met={item.met} />
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 6,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default PasswordCriteriaGrid;
