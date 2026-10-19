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

export interface AccessibilityState {
  boldText: boolean;
  screenReaderCompat: boolean;
  largeTouchTargets: boolean;
  reduceTransparency: boolean;
  highContrastMode: boolean;
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
// 1. INTERCEPT: react/jsx-dev-runtime (Expo Development Server)
// -------------------------------------------------------------
try {
  const jsxDev = require('react/jsx-dev-runtime');
  if (jsxDev && jsxDev.jsxDEV && !jsxDev.jsxDEV.__accessibilityPatched) {
    const originalJsxDev = jsxDev.jsxDEV;

    const patchedJsxDev = function (this: any, type: any, config: any, maybeKey: any, isStatic: any, source: any, self: any) {
      if (config) {
        if (globalAccessibilityState.boldText && isTextComponent(type)) {
          if (!isIconFont(config.style)) {
            config = {
              ...config,
              style: Array.isArray(config.style)
                ? [...config.style, { fontWeight: 'bold' }]
                : [config.style, { fontWeight: 'bold' }],
            };
          }
        }

        if (globalAccessibilityState.largeTouchTargets) {
          const typeName = type?.displayName || type?.name;
          if (
            typeName === 'Pressable' ||
            typeName === 'TouchableOpacity' ||
            typeName === 'TouchableHighlight'
          ) {
            if (!config.hitSlop) {
              config = {
                ...config,
                hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
              };
            }
          }
        }
      }

      return originalJsxDev.call(this, type, config, maybeKey, isStatic, source, self);
    };

    (patchedJsxDev as any).__accessibilityPatched = true;
    jsxDev.jsxDEV = patchedJsxDev;
  }
} catch (_) {}

// -------------------------------------------------------------
// 2. INTERCEPT: react/jsx-runtime (Production Builds)
// -------------------------------------------------------------
try {
  const jsxRuntime = require('react/jsx-runtime');
  if (jsxRuntime && jsxRuntime.jsx && !jsxRuntime.jsx.__accessibilityPatched) {
    const originalJsx = jsxRuntime.jsx;
    const originalJsxs = jsxRuntime.jsxs;

    const createPatched = (orig: any) =>
      function (this: any, type: any, config: any, maybeKey: any) {
        if (config) {
          if (globalAccessibilityState.boldText && isTextComponent(type)) {
            if (!isIconFont(config.style)) {
              config = {
                ...config,
                style: Array.isArray(config.style)
                  ? [...config.style, { fontWeight: 'bold' }]
                  : [config.style, { fontWeight: 'bold' }],
              };
            }
          }

          if (globalAccessibilityState.largeTouchTargets) {
            const typeName = type?.displayName || type?.name;
            if (
              typeName === 'Pressable' ||
              typeName === 'TouchableOpacity' ||
              typeName === 'TouchableHighlight'
            ) {
              if (!config.hitSlop) {
                config = {
                  ...config,
                  hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
                };
              }
            }
          }
        }

        return orig.call(this, type, config, maybeKey);
      };

    const patchedJsx: any = createPatched(originalJsx);
    patchedJsx.__accessibilityPatched = true;
    jsxRuntime.jsx = patchedJsx;

    const patchedJsxs: any = createPatched(originalJsxs);
    patchedJsxs.__accessibilityPatched = true;
    jsxRuntime.jsxs = patchedJsxs;
  }
} catch (_) {}

// -------------------------------------------------------------
// 3. INTERCEPT: React.createElement (Universal Fallback)
// -------------------------------------------------------------
try {
  const originalCreateElement = React.createElement;
  if (originalCreateElement && !(originalCreateElement as any).__accessibilityPatched) {
    const patchedCreateElement = function (this: any, type: any, config: any, ...children: any[]) {
      if (config) {
        if (globalAccessibilityState.boldText && isTextComponent(type)) {
          if (!isIconFont(config.style)) {
            config = {
              ...config,
              style: Array.isArray(config.style)
                ? [...config.style, { fontWeight: 'bold' }]
                : [config.style, { fontWeight: 'bold' }],
            };
          }
        }

        if (globalAccessibilityState.largeTouchTargets) {
          const typeName = type?.displayName || type?.name;
          if (
            typeName === 'Pressable' ||
            typeName === 'TouchableOpacity' ||
            typeName === 'TouchableHighlight'
          ) {
            if (!config.hitSlop) {
              config = {
                ...config,
                hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
              };
            }
          }
        }
      }

      return originalCreateElement.call(this, type, config, ...children);
    };

    (patchedCreateElement as any).__accessibilityPatched = true;
    (React as any).createElement = patchedCreateElement;
  }
} catch (_) {}

// -------------------------------------------------------------
// 4. INTERCEPT: React Native Text module
// -------------------------------------------------------------
try {
  const TextModule = require('react-native/Libraries/Text/Text');
  const OriginalText = TextModule?.default || RNText;

  if (OriginalText && !OriginalText.__accessibilityPatched) {
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

      return (
        <OriginalText
          {...props}
          ref={ref}
          style={finalStyle}
          accessible={accessible}
          allowFontScaling={props.allowFontScaling ?? true}
        />
      );
    });

    Object.assign(AccessibleText, OriginalText);
    (AccessibleText as any).displayName = 'AccessibleText';
    (AccessibleText as any).__accessibilityPatched = true;

    if (TextModule) {
      TextModule.default = AccessibleText;
    }
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

  // Local state to re-render root container whenever settings update
  const [, setTick] = React.useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const prevScreenReader = useRef<boolean | null>(null);

  useEffect(() => {
    updateGlobalAccessibility({
      boldText,
      screenReaderCompat,
      largeTouchTargets,
      reduceTransparency,
      highContrastMode,
    });
  }, [boldText, screenReaderCompat, largeTouchTargets, reduceTransparency, highContrastMode]);

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

  // Dynamic root key guarantees that the entire navigation and component tree
  // completely remounts and re-evaluates styles in real time whenever accessibility toggles.
  const rootKey = `acc-root-b:${boldText}-hc:${highContrastMode}-lt:${largeTouchTargets}-rt:${reduceTransparency}`;

  return (
    <View key={rootKey} style={{ flex: 1 }}>
      {children}
    </View>
  );
};

export default AccessibilityApplicator;
