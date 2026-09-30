import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardTypeOptions,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ExpressiveTheme, haptic } from '../../constants/authTheme';

interface AuthInputProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  isPassword?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  disabled?: boolean;
  rightLabelAction?: React.ReactNode;
  activeTheme: ExpressiveTheme;
  autoComplete?: string;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  label,
  required = true,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  isPassword = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  disabled = false,
  rightLabelAction,
  activeTheme,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  const accentColor = activeTheme.light.bg || activeTheme.accent;

  const togglePassword = () => {
    haptic('light');
    setShowPassword((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      {/* Label Row */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && (
            <Text style={[styles.asterisk, { color: accentColor }]}> *</Text>
          )}
        </Text>
        {rightLabelAction && (
          <View style={styles.rightLabel}>{rightLabelAction}</View>
        )}
      </View>

      {/* Input Field Box */}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: isFocused
              ? accentColor
              : 'rgba(255, 255, 255, 0.12)',
            borderWidth: isFocused ? 1.5 : 1,
            backgroundColor: isFocused
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(255, 255, 255, 0.03)',
          },
          disabled && styles.disabled,
        ]}
      >
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword ? !showPassword : secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.input}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={togglePassword}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.eyeButton}
          >
            <Animated.View
              key={showPassword ? 'eye-off' : 'eye-on'}
              entering={ZoomIn.duration(150)}
              exiting={ZoomOut.duration(150)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="rgba(255, 255, 255, 0.45)"
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 11,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 4,
    marginRight: 4,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: 'rgba(255, 255, 255, 0.82)',
    fontFamily: Platform.select({ ios: 'System', default: 'normal' }),
  },
  asterisk: {
    fontWeight: '800',
    fontSize: 14,
  },
  rightLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
    fontFamily: Platform.select({ ios: 'System', default: 'normal' }),
  },
  eyeButton: {
    paddingLeft: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default AuthInput;
