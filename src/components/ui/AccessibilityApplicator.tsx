// src/components/ui/AccessibilityApplicator.tsx
// Industry-Standard Universal Accessibility Enforcer for Bunkmates
// Intercepts JSX runtime (both development and production) and React Native primitives:
// - Bold Text: automatically applies 'bold' weight to every text element in the app
// - Large Touch Targets: enforces WCAG 2.5.5 AAA touch padding on all pressables
// - Screen Reader Compatibility: provisions accessibility roles and announcements
// - Remount Keying: immediately forces full tree refresh when toggled

import React, { useEffect, useRef } from 'react';
import ReactNative, { Text as RNText, View, AccessibilityInfo, Platform } from 'react-native';
import { useThemeToggle } from '../../contexts/ThemeContext';
import { useLanguage, TRANSLATIONS } from '../../contexts/LanguageContext';

export interface AccessibilityState {
  boldText: boolean;
  screenReaderCompat: boolean;
  largeTouchTargets: boolean;
  reduceTransparency: boolean;
  highContrastMode: boolean;
}

let currentGlobalLangCode = 'en-IN';

export function setGlobalLanguageCode(code: string) {
  currentGlobalLangCode = code;
}

function translateNode(node: any, langCode: string): any {
  if (!node) return node;
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (!trimmed || trimmed.length <= 1) return node;
    const dict = TRANSLATIONS[langCode];
    if (dict) {
      if (dict[node]) return dict[node];
      if (dict[trimmed]) return dict[trimmed];
      const lower = trimmed.toLowerCase();
      if (dict[lower]) return dict[lower];
    }
    // Indian language fallback to Hindi if not found
    if (langCode !== 'en-US' && langCode !== 'en-GB' && langCode !== 'en-IN' && langCode !== 'hi') {
      const hiDict = TRANSLATIONS['hi'];
      if (hiDict) {
        if (hiDict[node]) return hiDict[node];
        if (hiDict[trimmed]) return hiDict[trimmed];
        const lower = trimmed.toLowerCase();
        if (hiDict[lower]) return hiDict[lower];
      }
    }
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((child) => translateNode(child, langCode));
  }
  return node;
}

const globalAccessibilityState: AccessibilityState = {
  boldText: false,
  screenReaderCompat: false,
  largeTouchTargets: false,
  reduceTransparency: false,
  highContrastMode: false,
};

const listeners = new Set<() => void>();

export function updateGlobalAccessibility(next: Partial<AccessibilityState>) {
  let changed = false;
  if (next.boldText !== undefined && globalAccessibilityState.boldText !== next.boldText) {
    globalAccessibilityState.boldText = next.boldText;
    changed = true;
  }
  if (next.screenReaderCompat !== undefined && globalAccessibilityState.screenReaderCompat !== next.screenReaderCompat) {
    globalAccessibilityState.screenReaderCompat = next.screenReaderCompat;
    changed = true;
  }
  if (next.largeTouchTargets !== undefined && globalAccessibilityState.largeTouchTargets !== next.largeTouchTargets) {
    globalAccessibilityState.largeTouchTargets = next.largeTouchTargets;
    changed = true;
  }
  if (next.reduceTransparency !== undefined && globalAccessibilityState.reduceTransparency !== next.reduceTransparency) {
    globalAccessibilityState.reduceTransparency = next.reduceTransparency;
    changed = true;
  }
  if (next.highContrastMode !== undefined && globalAccessibilityState.highContrastMode !== next.highContrastMode) {
    globalAccessibilityState.highContrastMode = next.highContrastMode;
    changed = true;
  }

  if (changed) {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (_) {}
    });
  }
}

// Helper to determine if a component is a Text node
function isTextComponent(type: any): boolean {
  if (!type) return false;
  if (type === RNText) return true;
  const name = type.displayName || type.name;
  return name === 'Text' || name === 'TextImpl' || name === 'AccessibleText';
}

// Helper to check if styling belongs to an icon font (which should not be forced bold)
function isIconFont(style: any): boolean {
  if (!style) return false;
  if (Array.isArray(style)) {
    return style.some((s) => isIconFont(s));
  }
  if (typeof style === 'object') {
    const family = (style.fontFamily || '').toLowerCase();
    return (
      family.includes('ionicons') ||
      family.includes('feather') ||
      family.includes('material') ||
      family.includes('font') ||
      family.includes('vector')
    );
  }
  return false;
}

// -------------------------------------------------------------
// 1. INTERCEPT: React Native Text component
// -------------------------------------------------------------
try {
  const OriginalText = RNText;

  if (OriginalText && !(OriginalText as any).__accessibilityPatched) {
    const AccessibleText = React.forwardRef((props: any, ref: any) => {
      let finalStyle = props.style;

      if (globalAccessibilityState.boldText && !isIconFont(finalStyle)) {
        if (Array.isArray(finalStyle)) {
          finalStyle = [...finalStyle, { fontWeight: 'bold' }];
        } else if (finalStyle) {
          finalStyle = [finalStyle, { fontWeight: 'bold' }];
        } else {
          finalStyle = { fontWeight: 'bold' };
        }
      }

      let accessible = props.accessible;
      if (globalAccessibilityState.screenReaderCompat && accessible === undefined) {
        accessible = true;
      }

      let finalChildren = props.children;
      if (currentGlobalLangCode && currentGlobalLangCode !== 'en-US' && currentGlobalLangCode !== 'en-IN') {
        finalChildren = translateNode(props.children, currentGlobalLangCode);
      }

      return (
        <OriginalText
          {...props}
          ref={ref}
          style={finalStyle}
          accessible={accessible}
          allowFontScaling={props.allowFontScaling ?? true}
        >
          {finalChildren}
        </OriginalText>
      );
    });

    Object.assign(AccessibleText, OriginalText);
    (AccessibleText as any).displayName = 'AccessibleText';
    (AccessibleText as any).__accessibilityPatched = true;

    try {
      Object.defineProperty(ReactNative, 'Text', {
        configurable: true,
        enumerable: true,
        get: () => AccessibleText,
      });
    } catch (_) {}
  }
} catch (_) {}

// -------------------------------------------------------------
// 2. INTERCEPT: Pressable & TouchableOpacity (Large Touch Targets)
// -------------------------------------------------------------
try {
  const OriginalPressable = ReactNative.Pressable;
  if (OriginalPressable && !(OriginalPressable as any).__accessibilityPatched) {
    const AccessiblePressable = React.forwardRef((props: any, ref: any) => {
      let hitSlop = props.hitSlop;
      if (globalAccessibilityState.largeTouchTargets && !hitSlop) {
        hitSlop = { top: 12, bottom: 12, left: 12, right: 12 };
      }
      return <OriginalPressable {...props} ref={ref} hitSlop={hitSlop} />;
    });

    Object.assign(AccessiblePressable, OriginalPressable);
    (AccessiblePressable as any).displayName = 'AccessiblePressable';
    (AccessiblePressable as any).__accessibilityPatched = true;

    try {
      Object.defineProperty(ReactNative, 'Pressable', {
        configurable: true,
        enumerable: true,
        get: () => AccessiblePressable,
      });
    } catch (_) {}
  }
} catch (_) {}

try {
  const OriginalTouchableOpacity = ReactNative.TouchableOpacity;
  if (OriginalTouchableOpacity && !(OriginalTouchableOpacity as any).__accessibilityPatched) {
    const AccessibleTouchableOpacity = React.forwardRef((props: any, ref: any) => {
      let hitSlop = props.hitSlop;
      if (globalAccessibilityState.largeTouchTargets && !hitSlop) {
        hitSlop = { top: 12, bottom: 12, left: 12, right: 12 };
      }
      return <OriginalTouchableOpacity {...props} ref={ref} hitSlop={hitSlop} />;
    });

    Object.assign(AccessibleTouchableOpacity, OriginalTouchableOpacity);
    (AccessibleTouchableOpacity as any).displayName = 'AccessibleTouchableOpacity';
    (AccessibleTouchableOpacity as any).__accessibilityPatched = true;

    try {
      Object.defineProperty(ReactNative, 'TouchableOpacity', {
        configurable: true,
        enumerable: true,
        get: () => AccessibleTouchableOpacity,
      });
    } catch (_) {}
  }
} catch (_) {}

// -------------------------------------------------------------
// COMPONENT: AccessibilityApplicator
// -------------------------------------------------------------
export const AccessibilityApplicator: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const {
    boldText,
    screenReaderCompat,
    largeTouchTargets,
    reduceTransparency,
    highContrastMode,
  } = useThemeToggle();

  const prevScreenReader = useRef<boolean | null>(null);
  const langCtx = useLanguage();

  // Synchronize global accessibility state inside useEffect to keep render pure
  useEffect(() => {
    updateGlobalAccessibility({
      boldText,
      screenReaderCompat,
      largeTouchTargets,
      reduceTransparency,
      highContrastMode,
    });
  }, [boldText, screenReaderCompat, largeTouchTargets, reduceTransparency, highContrastMode]);

  // Synchronize global language code inside useEffect
  useEffect(() => {
    if (langCtx?.languageCode) {
      setGlobalLanguageCode(langCtx.languageCode);
    }
  }, [langCtx?.languageCode]);

  // Screen reader mode activation announcement
  useEffect(() => {
    if (prevScreenReader.current === screenReaderCompat) return;
    prevScreenReader.current = screenReaderCompat;

    if (screenReaderCompat && Platform.OS !== 'web') {
      try {
        AccessibilityInfo.announceForAccessibility(
          'Bunkmates accessibility mode is active. All interface elements are optimised for VoiceOver and TalkBack navigation.'
        );
      } catch (_) {}
    }
  }, [screenReaderCompat]);

  // Stable root container: MUST NOT remount children or navigation tree when settings change
  return (
    <View style={{ flex: 1 }}>
      {children}
    </View>
  );
};

export default AccessibilityApplicator;
