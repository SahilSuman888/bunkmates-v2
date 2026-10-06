import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  Keyboard,
  useColorScheme,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from '../../lib/firebase';
import {
  M3_EXPRESSIVE_PALETTE,
  PALETTE_KEYS,
  AUTH_SLOGANS,
  haptic,
  checkPasswordRules,
  getDicebearAvatar,
  ExpressiveTheme,
} from '../../constants/authTheme';
import AuthHero from '../../components/auth/AuthHero';
import AuthInput from '../../components/auth/AuthInput';
import GoogleColoredIcon from '../../components/auth/GoogleColoredIcon';
import PasswordCriteriaGrid from '../../components/auth/PasswordCriteriaGrid';
import UserProfileCard from '../../components/auth/UserProfileCard';
import { extractResetCode, parseAuthParams } from '../../lib/authUrlHelper';

let GoogleSignin: any = null;
try {
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    (Constants as any).executionEnvironment === 'storeClient';
  if (!isExpoGo) {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  }
} catch (error) {
  console.log('Google Sign-In native module unavailable in this environment:', error);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ViewMode =
  | 'welcome'
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'reset-password'
  | 'continue';

// Exact Framer Motion animation configs from bunk-mates-master (AuthPage.jsx & subcomponents)
const springTransition = {
  stiffness: 230,
  damping: 27,
  mass: 0.9,
};

const smoothEasing = Easing.bezier(0.16, 1, 0.3, 1);
const continueEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

const makeItemEntering = (delayMs: number) =>
  FadeInDown.delay(delayMs).duration(320).easing(smoothEasing);

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface AnimatedTouchableScaleProps extends React.ComponentProps<typeof TouchableOpacity> {
  scaleTo?: number;
}

const AnimatedTouchableScale: React.FC<AnimatedTouchableScaleProps> = ({
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  style,
  children,
  activeOpacity = 0.85,
  scaleTo = 0.985,
  ...rest
}) => {
  const scale = useSharedValue(1);

  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    scale.value = withTiming(scaleTo, { duration: 100, easing: Easing.out(Easing.quad) });
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
    if (onPressOut) onPressOut(e);
  };

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={activeOpacity}
      style={[style, animatedScaleStyle]}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
};

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsedParams = useMemo(() => parseAuthParams(params), [params]);

  const initialMode = useMemo<ViewMode>(() => {
    if (parsedParams.isReset) return 'reset-password';
    if (params.mode && ['welcome', 'login', 'signup', 'forgot-password', 'reset-password', 'continue'].includes(params.mode)) {
      return params.mode as ViewMode;
    }
    return 'welcome';
  }, [params.mode, parsedParams.isReset]);

  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleInputFocus = useCallback((offset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: offset, animated: true });
    }, 90);
  }, []);

  // Track mode history stack for route -1 back navigation
  const modeHistoryRef = useRef<ViewMode[]>(
    initialMode !== 'welcome' ? ['welcome', initialMode] : ['welcome']
  );

  useEffect(() => {
    const history = modeHistoryRef.current;
    if (history[history.length - 1] !== viewMode) {
      const existingIndex = history.lastIndexOf(viewMode);
      if (existingIndex !== -1) {
        modeHistoryRef.current = history.slice(0, existingIndex + 1);
      } else {
        history.push(viewMode);
      }
    }
  }, [viewMode]);

  // Unified back navigation (handles both UI back buttons and device navigation)
  const handleBack = useCallback(() => {
    haptic('light');
    setError('');

    const history = modeHistoryRef.current;
    // If there is internal screen history (e.g., welcome -> login -> forgot-password)
    if (history.length > 1) {
      history.pop(); // remove current viewMode
      const prevMode = history[history.length - 1] || 'welcome';
      setViewMode(prevMode);
      return true;
    }

    // If at root of history but not on welcome, return to welcome first
    if (viewMode !== 'welcome') {
      modeHistoryRef.current = ['welcome'];
      setViewMode('welcome');
      return true;
    }

    // At root of auth views, route -1 if previous screen exists in router stack
    if (router.canGoBack()) {
      router.back();
      return true;
    }

    return false;
  }, [viewMode, router]);

  // Intercept device back navigation (hardware button / swipe back gesture)
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        return handleBack();
      }
    );

    return () => backSubscription.remove();
  }, [handleBack]);

  const [sloganIndex, setSloganIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);

  // General state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<any>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupData, setSignupData] = useState({
    name: '',
    mobile: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [matchedUser, setMatchedUser] = useState<any>(null);
  const [searchingProfile, setSearchingProfile] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // Reset password state
  const [oobCode, setOobCode] = useState(parsedParams.oobCode || params.oobCode || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  const [verifyingResetCode, setVerifyingResetCode] = useState(false);
  const [resetCodeVerified, setResetCodeVerified] = useState<boolean | null>(null);
  const [resetAccountUser, setResetAccountUser] = useState<any>(null);
  const [resetEmail, setResetEmail] = useState('');

  const searchTimerRef = useRef<any>(null);
  const forgotSearchTimerRef = useRef<any>(null);

  // Floating animation for Continue avatar (4s cycle matching React.js AuthContinue.jsx)
  const avatarFloatY = useSharedValue(0);
  useEffect(() => {
    avatarFloatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedAvatarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: avatarFloatY.value }],
  }));

  // Floating animation for Recovery lock icon (3.5s cycle matching React.js AuthForgotPassword.jsx)
  const lockFloatY = useSharedValue(0);
  useEffect(() => {
    lockFloatY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedLockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lockFloatY.value }],
  }));

  // Ambient lighting orb pulsation (8s cycle matching React.js AuthPage.jsx)
  const orbScale = useSharedValue(1);
  const orbOpacity = useSharedValue(0.15);
  useEffect(() => {
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    orbOpacity.value = withRepeat(
      withSequence(
        withTiming(0.28, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    opacity: orbOpacity.value,
  }));

  const isFormPage =
    viewMode === 'login' ||
    viewMode === 'signup' ||
    viewMode === 'forgot-password' ||
    viewMode === 'reset-password';

  // Card container border radius spring transition (matching React.js AuthPage.jsx)
  const cardBorderRadius = useSharedValue(isFormPage ? 36 : 0);
  useEffect(() => {
    cardBorderRadius.value = withSpring(isFormPage ? 36 : 0, springTransition);
  }, [isFormPage]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    borderTopLeftRadius: cardBorderRadius.value,
    borderTopRightRadius: cardBorderRadius.value,
  }));

  // Active theme
  const activeTheme: ExpressiveTheme = useMemo(() => {
    const key = PALETTE_KEYS[colorIndex % PALETTE_KEYS.length];
    return M3_EXPRESSIVE_PALETTE[key] || M3_EXPRESSIVE_PALETTE.amber;
  }, [colorIndex]);

  // Slogan & Palette cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % AUTH_SLOGANS.length);
      setColorIndex((prev) => (prev + 1) % PALETTE_KEYS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Configure Google Sign-In
  useEffect(() => {
    if (!GoogleSignin || typeof GoogleSignin.configure !== 'function') {
      return;
    }
    GoogleSignin.configure({
      webClientId:
        '37810808180-4su0afr7ht944vfpf4naiptfh9ldbfqs.apps.googleusercontent.com',
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
  }, []);

  // Deep link listener for password reset & auth action links
  useEffect(() => {
    const handleIncomingUrl = (url: string | null) => {
      if (!url) return;
      console.log('Incoming deep link in AuthScreen:', url);
      const parsed = parseAuthParams(url);
      if (parsed.oobCode) {
        setOobCode(parsed.oobCode);
        setViewMode('reset-password');
        setError('');
        haptic('medium');
      } else if (parsed.isReset) {
        setViewMode('reset-password');
      }
    };

    // Initial launch URL check
    Linking.getInitialURL()
      .then(handleIncomingUrl)
      .catch((err) => {
        console.warn('Error reading initial deep link URL:', err);
      });

    // Foreground / background deep link listener
    const subscription = Linking.addEventListener('url', (event) => {
      handleIncomingUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Sync mode and oobCode params if navigated via Expo Router
  useEffect(() => {
    const parsed = parseAuthParams(params);
    if (parsed.oobCode) {
      setOobCode(parsed.oobCode);
      setViewMode('reset-password');
    } else if (parsed.isReset) {
      setViewMode('reset-password');
    } else if (params.mode && ['welcome', 'login', 'signup', 'forgot-password', 'reset-password', 'continue'].includes(params.mode)) {
      setViewMode(params.mode as ViewMode);
    }
  }, [params]);

  // Verify password reset code when in reset-password mode with oobCode
  useEffect(() => {
    if (viewMode !== 'reset-password' || !oobCode) {
      return;
    }

    let isMounted = true;
    const verifyCode = async () => {
      try {
        setVerifyingResetCode(true);
        setError('');
        const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
        if (!isMounted) return;
        setResetEmail(verifiedEmail);
        setResetCodeVerified(true);

        try {
          const q = query(
            collection(db, 'users'),
            where('email', '==', verifiedEmail.toLowerCase())
          );
          const snap = await getDocs(q);
          if (!snap.empty && isMounted) {
            setResetAccountUser(snap.docs[0].data());
          } else if (isMounted) {
            setResetAccountUser({
              name: verifiedEmail.split('@')[0],
              username: verifiedEmail.split('@')[0],
              email: verifiedEmail,
            });
          }
        } catch {
          if (isMounted) {
            setResetAccountUser({
              name: verifiedEmail.split('@')[0],
              username: verifiedEmail.split('@')[0],
              email: verifiedEmail,
            });
          }
        }
      } catch (err: any) {
        console.error('Password reset code verification failed:', err);
        if (isMounted) {
          setResetCodeVerified(false);
          if (err.code === 'auth/expired-action-code') {
            setError('This password reset link has expired. Please request a new one.');
          } else if (err.code === 'auth/invalid-action-code') {
            setError('This password reset link is invalid or has already been used.');
          } else {
            setError(err.message || 'Unable to verify reset link. Please request a new one.');
          }
        }
      } finally {
        if (isMounted) {
          setVerifyingResetCode(false);
        }
      }
    };

    verifyCode();
    return () => {
      isMounted = false;
    };
  }, [viewMode, oobCode]);

  /* ---------------- FIREBASE EMAIL LOGIN ---------------- */
  const handleEmailLogin = async () => {
    Keyboard.dismiss();
    haptic('medium');

    const cleanEmail = loginEmail.trim();
    if (!cleanEmail || !loginPassword) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, loginPassword);
      const user = credential.user;

      setLoggedInUser({
        uid: user.uid,
        displayName: user.displayName || 'BunkMate Member',
        email: user.email,
        photoURL: user.photoURL,
      });
      setViewMode('continue');
    } catch (err: any) {
      console.error('Login error:', err);
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Login failed. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- FIREBASE EMAIL SIGNUP ---------------- */
  const handleSignupChange = (name: string, value: string) => {
    setSignupData((prev) => ({ ...prev, [name]: value }));
    setError('');

    if (name === 'username') {
      const clean = value.replace(/^@/, '').trim();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (clean.length >= 3) {
        setCheckingUsername(true);
        searchTimerRef.current = setTimeout(async () => {
          try {
            const q = query(collection(db, 'users'), where('username', '==', clean));
            const snap = await getDocs(q);
            setUsernameAvailable(snap.empty);
          } catch (err) {
            console.warn('Username check error:', err);
            setUsernameAvailable(true);
          } finally {
            setCheckingUsername(false);
          }
        }, 400);
      } else {
        setUsernameAvailable(null);
        setCheckingUsername(false);
      }
    }
  };

  const signupPasswordRules = checkPasswordRules(signupData.password);
  const isSignupPasswordStrong = Object.values(signupPasswordRules).every(Boolean);
  const doSignupPasswordsMatch =
    Boolean(signupData.password) && signupData.password === signupData.confirmPassword;

  const handleEmailSignup = async () => {
    Keyboard.dismiss();
    haptic('medium');

    const cleanEmail = signupData.email.trim();
    const cleanUsername = signupData.username.replace(/^@/, '').trim();

    if (!signupData.name.trim()) {
      setError('Please provide your name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (usernameAvailable === false) {
      setError('This username is already taken. Please choose another.');
      return;
    }
    if (!isSignupPasswordStrong) {
      setError('Please meet all password requirements.');
      return;
    }
    if (!doSignupPasswordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, signupData.password);
      const user = credential.user;
      const avatarUrl = getDicebearAvatar(user.uid);

      await updateProfile(user, {
        displayName: signupData.name.trim(),
        photoURL: avatarUrl,
      });

      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: signupData.name.trim(),
          mobile: signupData.mobile.trim(),
          username: cleanUsername,
          email: cleanEmail,
          photoURL: avatarUrl,
          provider: 'password',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
      } catch (dbErr) {
        console.warn('Firestore user doc creation warning:', dbErr);
      }

      setLoggedInUser({
        uid: user.uid,
        displayName: signupData.name.trim(),
        email: cleanEmail,
        photoURL: avatarUrl,
      });
      setViewMode('continue');
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Please login instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- FORGOT PASSWORD ---------------- */
  const sanitizeEmailKey = (rawEmail: string) =>
    rawEmail.trim().toLowerCase().replace(/[.@#$[\]]/g, '_');

  const checkFirestoreRateLimit = useCallback(async (cleanEmail: string) => {
    try {
      const docKey = sanitizeEmailKey(cleanEmail);
      const resetRef = doc(db, 'password_resets', docKey);
      const resetDoc = await getDoc(resetRef);

      if (resetDoc.exists()) {
        const data = resetDoc.data();
        const now = Date.now();
        const seventyTwoHoursMs = 72 * 60 * 60 * 1000;
        const rawAttempts: number[] = Array.isArray(data.attempts) ? data.attempts : [];
        const recentAttempts = rawAttempts.filter((ts) => now - ts < seventyTwoHoursMs);

        if (recentAttempts.length >= 5) {
          const oldestAttempt = Math.min(...recentAttempts);
          const hoursLeft = Math.ceil(
            (seventyTwoHoursMs - (now - oldestAttempt)) / (1000 * 60 * 60)
          );
          setIsBlocked(true);
          setError(
            `Password reset limit reached (5 attempts per 72 hours). Retry in ~${hoursLeft} hours.`
          );
          return false;
        }
      }
      setIsBlocked(false);
      return true;
    } catch (err) {
      console.warn('Rate limit check warning:', err);
      return true;
    }
  }, []);

  // Debounced profile search for forgot-password
  useEffect(() => {
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      setMatchedUser(null);
      setSearchingProfile(false);
      return;
    }

    if (forgotSearchTimerRef.current) clearTimeout(forgotSearchTimerRef.current);

    forgotSearchTimerRef.current = setTimeout(async () => {
      setSearchingProfile(true);
      try {
        const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setMatchedUser(snap.docs[0].data());
        } else {
          setMatchedUser(null);
        }
      } catch {
        setMatchedUser(null);
      } finally {
        setSearchingProfile(false);
      }
    }, 450);

    return () => {
      if (forgotSearchTimerRef.current) clearTimeout(forgotSearchTimerRef.current);
    };
  }, [forgotEmail]);

  const handleSendReset = async () => {
    Keyboard.dismiss();
    haptic('medium');

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    const allowed = await checkFirestoreRateLimit(cleanEmail);
    if (!allowed) return;

    try {
      setLoading(true);
      setError('');
      setForgotMessage('');

      try {
        await sendPasswordResetEmail(auth, cleanEmail, {
          url: 'https://bunk-mates-beccc.firebaseapp.com/reset-password',
          handleCodeInApp: true,
          iOS: {
            bundleId: 'com.bm.bunkmates',
          },
          android: {
            packageName: 'com.bm.bunkmates',
            installApp: false,
            minimumVersion: '1',
          },
        });
      } catch (actionErr: any) {
        if (
          actionErr.code === 'auth/unauthorized-continue-uri' ||
          actionErr.code === 'auth/invalid-continue-uri' ||
          actionErr.code === 'auth/argument-error'
        ) {
          console.warn('Falling back to standard password reset email:', actionErr.message);
          await sendPasswordResetEmail(auth, cleanEmail);
        } else {
          throw actionErr;
        }
      }

      try {
        const docKey = sanitizeEmailKey(cleanEmail);
        const resetRef = doc(db, 'password_resets', docKey);
        const snap = await getDoc(resetRef);
        const now = Date.now();
        const prevAttempts = snap.exists() && Array.isArray(snap.data()?.attempts)
          ? snap.data().attempts
          : [];
        await setDoc(resetRef, {
          email: cleanEmail,
          attempts: [...prevAttempts, now],
          lastAttempt: serverTimestamp(),
        }, { merge: true });
      } catch (logErr) {
        console.warn('Audit logging warning:', logErr);
      }

      setRequestSent(true);
      setForgotMessage(`Password reset link sent to ${cleanEmail}. Please check your inbox.`);
      haptic('heavy');
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few moments.');
      } else {
        setError(err.message || 'Failed to send password reset email.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- RESET PASSWORD (CONFIRM NEW PASSWORD) ---------------- */
  const resetPasswordRules = checkPasswordRules(newPassword);
  const isResetPasswordStrong = Object.values(resetPasswordRules).every(Boolean);
  const doResetPasswordsMatch = Boolean(newPassword) && newPassword === confirmResetPassword;

  const handleConfirmReset = async () => {
    Keyboard.dismiss();
    haptic('medium');

    if (!oobCode) {
      setError('Invalid or expired reset code. Please request a new link.');
      return;
    }
    if (!isResetPasswordStrong) {
      setError('Please satisfy all password security requirements.');
      return;
    }
    if (!doResetPasswordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResetSuccessMessage('');
      await confirmPasswordReset(auth, oobCode, newPassword);
      setResetSuccessMessage('Password updated successfully! Please login with your new password.');
      haptic('heavy');
      setTimeout(() => {
        setError('');
        setResetSuccessMessage('');
        setViewMode('login');
      }, 1600);
    } catch (err: any) {
      console.error('Confirm password reset error:', err);
      setError(err.message || 'Failed to update password. Code may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteResetLink = async () => {
    haptic('medium');
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        setError('Clipboard is empty. Copy the reset link from your email first.');
        return;
      }
      const code = extractResetCode(text);
      if (code) {
        setError('');
        setOobCode(code);
        setViewMode('reset-password');
        haptic('heavy');
      } else {
        setError('No valid reset link or code found in clipboard.');
      }
    } catch (err: any) {
      setError('Could not access clipboard: ' + (err.message || 'Permission denied'));
    }
  };

  /* ---------------- GOOGLE SIGN IN ---------------- */
  const handleGoogleLogin = async () => {
    haptic('medium');
    try {
      setLoading(true);
      setError('');

      let userCredential: any;

      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        userCredential = await signInWithPopup(auth, provider);
      } else {
        if (
          !GoogleSignin ||
          typeof GoogleSignin.hasPlayServices !== 'function' ||
          typeof GoogleSignin.signIn !== 'function'
        ) {
          throw new Error('Google Sign-In is not available in this environment');
        }

        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
        const response = await GoogleSignin.signIn();
        const idToken = response.idToken ?? response.data?.idToken;

        if (!idToken) {
          throw new Error('No ID Token received');
        }

        const credential = GoogleAuthProvider.credential(idToken);
        userCredential = await signInWithCredential(auth, credential);
      }

      const user = userCredential.user;
      const avatarUrl = user.photoURL || getDicebearAvatar(user.uid);

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || 'Original Bunker',
            username:
              user.displayName?.toLowerCase().replace(/\s+/g, '_') ||
              `user_${user.uid.slice(0, 5)}`,
            email: user.email,
            photoURL: avatarUrl,
            provider: 'google',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
        }
      } catch (dbErr) {
        console.warn('Firestore sync warning:', dbErr);
      }

      setLoggedInUser({
        uid: user.uid,
        displayName: user.displayName || 'Original Bunker',
        email: user.email,
        photoURL: avatarUrl,
      });
      setViewMode('continue');
    } catch (e: any) {
      console.log('Google login error:', e);
      setError(e.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToApp = () => {
    haptic('medium');
    router.replace('/(tabs)/home');
  };

  const primaryBg = activeTheme.light.bg;
  const primaryText = activeTheme.light.text;
  const accentColor = activeTheme.light.bg || activeTheme.accent;

  const currentSlogan = AUTH_SLOGANS[sloganIndex % AUTH_SLOGANS.length];
  const screenBg = isFormPage ? primaryBg : '#000000';
  const bottomInset = Math.max(insets.bottom + 14, 28);

  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';

  // Top Reflection Box Shadow for Create New Account Button
  const createAccountBoxShadow = isDark
    ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
    : "inset 0 1px 1px rgba(255, 255, 255, 0.8), inset 0 -1px 1px rgba(0, 0, 0, 0.1)";

  return (
    <View style={[styles.screen, { backgroundColor: '#000000' }]}>
      {/* Top Hero Backdrop to ensure top status bar and pull bounce show the hero theme color */}
      {isFormPage && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(340, Math.round(SCREEN_HEIGHT * 0.45)),
            backgroundColor: primaryBg,
          }}
        />
      )}

      {/* Subtle ambient lighting orb in background matching React AuthPage.jsx */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientOrb,
          { backgroundColor: activeTheme.accent },
          animatedOrbStyle,
        ]}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              backgroundColor: 'transparent',
              paddingBottom: isKeyboardVisible ? Math.max(keyboardHeight - 80, 80) : 0,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* ================= TOP HERO SECTION ================= */}
          <AuthHero
            activeTheme={activeTheme}
            isKeyboardVisible={isKeyboardVisible}
            slogan={
              viewMode === 'continue'
                ? 'Explore\nTogether\nAlways'
                : viewMode === 'login'
                ? 'Explore\nTogether\nAlways'
                : currentSlogan
            }
            subtitle={
              viewMode === 'signup'
                ? 'JOIN TO'
                : viewMode === 'forgot-password' || viewMode === 'reset-password'
                ? 'ACCOUNT RECOVERY'
                : undefined
            }
            title={
              viewMode === 'signup' ||
              viewMode === 'forgot-password' ||
              viewMode === 'reset-password'
                ? 'BunkMates'
                : undefined
            }
            mode={
              viewMode === 'welcome'
                ? 'welcome'
                : viewMode === 'login'
                ? 'login'
                : viewMode === 'signup'
                ? 'signup'
                : viewMode === 'forgot-password' || viewMode === 'reset-password'
                ? 'recovery'
                : 'continue'
            }
          />

          {/* ================= BOTTOM BLACK CONTAINER ================= */}
          <Animated.View
            style={[
              styles.cardContainer,
              {
                minHeight: Math.round(SCREEN_HEIGHT * 0.70),
                paddingBottom: isKeyboardVisible ? 24 : Math.max(insets.bottom + 16, 28),
                paddingTop: isFormPage ? 28 : 24,
              },
              viewMode === 'welcome' && styles.cardWelcome,
              isFormPage && styles.cardForm,
              viewMode === 'continue' && styles.cardContinue,
              animatedCardStyle,
            ]}
          >
            {/* ---------------- 1. WELCOME VIEW ---------------- */}
            {viewMode === 'welcome' && (
              <Animated.View
                key="welcome-view"
                entering={FadeInDown.duration(380).easing(smoothEasing)}
                exiting={FadeOutUp.duration(220).easing(Easing.in(Easing.quad))}
                style={styles.welcomeInner}
              >
                {/* Header Titles */}
                <Animated.View entering={makeItemEntering(20)} style={[styles.headerSection, { marginBottom: 24 }]}>
                  <Text style={styles.headerSubtitle}>WELCOME TO</Text>
                  <Text style={styles.headerTitle}>BunkMates</Text>
                </Animated.View>

                {/* Button Stack with exact spacing from screenshot */}
                <View style={styles.buttonStack}>
                  {/* LOGIN WITH EMAIL */}
                  <Animated.View entering={makeItemEntering(80)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.primaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: primaryBg,
                          marginBottom: 12,
                        },
                      ]}
                      onPress={() => {
                        haptic('light');
                        setError('');
                        setViewMode('login');
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.buttonRow}>
                        <Ionicons
                          name="mail-outline"
                          size={19}
                          color={primaryText}
                          style={styles.btnIcon}
                        />
                        <Text style={[styles.primaryButtonText, { color: primaryText }]}>
                          LOGIN WITH EMAIL
                        </Text>
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>

                  {/* CREATE NEW ACCOUNT (with Top Reflection) */}
                  <Animated.View entering={makeItemEntering(140)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.secondaryButton,
                        styles.createAccountButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          marginBottom: 12,
                          boxShadow: createAccountBoxShadow,
                        } as any,
                      ]}
                      onPress={() => {
                        haptic('light');
                        setError('');
                        setViewMode('signup');
                      }}
                      activeOpacity={0.85}
                    >
                      {/* Top Reflection Highlight */}
                      <View
                        pointerEvents="none"
                        style={[
                          styles.topReflectionHighlight,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.11)'
                              : 'rgba(255, 255, 255, 0.8)',
                          },
                        ]}
                      />
                      <View style={styles.buttonRow}>
                        <Ionicons
                          name="mail-outline"
                          size={19}
                          color="#ffffff"
                          style={styles.btnIcon}
                        />
                        <Text style={styles.secondaryButtonText}>
                          CREATE NEW ACCOUNT
                        </Text>
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>

                  {/* OR DIVIDER */}
                  <Animated.View entering={makeItemEntering(200)} style={[styles.dividerRow, { marginVertical: 0, marginBottom: 12 }]}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </Animated.View>

                  {/* CONTINUE WITH GOOGLE */}
                  <Animated.View entering={makeItemEntering(260)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.primaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: primaryBg,
                        },
                      ]}
                      onPress={handleGoogleLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <View style={styles.buttonRow}>
                        {loading ? (
                          <ActivityIndicator size="small" color={primaryText} />
                        ) : (
                          <>
                            <View style={styles.btnIcon}>
                              <GoogleColoredIcon size={20} />
                            </View>
                            <Text
                              style={[styles.primaryButtonText, { color: primaryText }]}>
                              CONTINUE WITH GOOGLE
                            </Text>
                          </>
                        )}
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>
                </View>
              </Animated.View>
            )}

            {/* ---------------- 2. LOGIN VIEW ---------------- */}
            {viewMode === 'login' && (
              <Animated.View
                key="login-view"
                entering={FadeInDown.duration(380).easing(smoothEasing)}
                exiting={FadeOutUp.duration(220).easing(Easing.in(Easing.quad))}
                style={styles.formInner}
              >
                <View style={styles.formTop}>
                  <Animated.View entering={makeItemEntering(30)} style={styles.headerSection}>
                    <View style={styles.titleRow}>
                      <View>
                        <Text style={styles.headerSubtitle}>LOGIN TO</Text>
                        <Text style={styles.headerTitle}>BunkMates</Text>
                      </View>
                      <AnimatedTouchableScale
                        onPress={handleBack}
                        style={styles.backIconButton}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
                      </AnimatedTouchableScale>
                    </View>
                  </Animated.View>

                  {/* Success banner if redirected from reset password */}
                  {resetSuccessMessage ? (
                    <Animated.View entering={makeItemEntering(60)} style={styles.successBanner}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={17}
                        color="#4ade80"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.successText}>{resetSuccessMessage}</Text>
                    </Animated.View>
                  ) : null}

                  <Animated.View entering={makeItemEntering(90)}>
                    <AuthInput
                      label="Email Address"
                      required
                      placeholder="user@bunkmates.com"
                      value={loginEmail}
                      onChangeText={(val) => {
                        setLoginEmail(val);
                        if (error) setError('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(0)}
                    />
                  </Animated.View>

                  <Animated.View entering={makeItemEntering(150)}>
                    <AuthInput
                      label="Password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChangeText={(val) => {
                        setLoginPassword(val);
                        if (error) setError('');
                      }}
                      secureTextEntry
                      isPassword
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(70)}
                    />
                  </Animated.View>

                  {/* Forgot Password Link */}
                  <Animated.View entering={makeItemEntering(210)}>
                    <TouchableOpacity
                      style={styles.forgotPassLink}
                      onPress={() => {
                        haptic('light');
                        setError('');
                        setForgotEmail(loginEmail);
                        setViewMode('forgot-password');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.forgotPassText}>Forgot password?</Text>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Error Alert Banner */}
                  {error ? (
                    <Animated.View
                      entering={FadeInDown.duration(250).easing(smoothEasing)}
                      exiting={FadeOutUp.duration(200).easing(Easing.ease)}
                      style={styles.errorBanner}
                    >
                      <Ionicons
                        name="alert-circle-outline"
                        size={16}
                        color="#f87171"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                  ) : null}
                </View>

                {/* Bottom Action Buttons */}
                <View style={styles.formBottomSection}>
                  {/* LOGIN BUTTON */}
                  <Animated.View entering={makeItemEntering(270)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.primaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: primaryBg,
                          marginBottom: 12,
                        },
                      ]}
                      onPress={handleEmailLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={primaryText} />
                      ) : (
                        <Text style={[styles.primaryButtonText, { color: primaryText }]}>
                          LOGIN
                        </Text>
                      )}
                    </AnimatedTouchableScale>
                  </Animated.View>

                  {/* OR DIVIDER */}
                  <Animated.View entering={makeItemEntering(330)} style={[styles.dividerRow, { marginVertical: 0, marginBottom: 12 }]}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </Animated.View>

                  {/* CREATE NEW ACCOUNT BUTTON */}
                  <Animated.View entering={makeItemEntering(390)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.secondaryButton,
                        styles.createAccountButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          marginBottom: 10,
                          boxShadow: createAccountBoxShadow,
                        } as any,
                      ]}
                      onPress={() => {
                        haptic('light');
                        setError('');
                        setViewMode('signup');
                      }}
                      activeOpacity={0.85}
                    >
                      {/* Top Reflection Highlight */}
                      <View
                        pointerEvents="none"
                        style={[
                          styles.topReflectionHighlight,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.11)'
                              : 'rgba(255, 255, 255, 0.8)',
                          },
                        ]}
                      />
                      <View style={styles.buttonRow}>
                        <Ionicons
                          name="mail-outline"
                          size={19}
                          color="#ffffff"
                          style={styles.btnIcon}
                        />
                        <Text style={styles.secondaryButtonText}>
                          CREATE NEW ACCOUNT
                        </Text>
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>

                  {/* CONTINUE WITH GOOGLE BUTTON */}
                  <Animated.View entering={makeItemEntering(450)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.primaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: primaryBg,
                        },
                      ]}
                      onPress={handleGoogleLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <View style={styles.buttonRow}>
                        <View style={styles.btnIcon}>
                          <GoogleColoredIcon size={20} />
                        </View>
                        <Text style={[styles.primaryButtonText, { color: primaryText }]}>
                          CONTINUE WITH GOOGLE
                        </Text>
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>
                </View>
              </Animated.View>
            )}

            {/* ---------------- 3. SIGNUP VIEW ---------------- */}
            {viewMode === 'signup' && (
              <Animated.View
                key="signup-view"
                entering={FadeInDown.duration(380).easing(smoothEasing)}
                exiting={FadeOutUp.duration(220).easing(Easing.in(Easing.quad))}
                style={styles.formInner}
              >
                <View style={styles.formTop}>
                  {/* Name */}
                  <Animated.View entering={makeItemEntering(20)}>
                    <AuthInput
                      label="Full Name"
                      required
                      placeholder="Original Bunker"
                      value={signupData.name}
                      onChangeText={(val) => handleSignupChange('name', val)}
                      autoCapitalize="words"
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(0)}
                    />
                  </Animated.View>

                  {/* Mobile */}
                  <Animated.View entering={makeItemEntering(70)}>
                    <AuthInput
                      label="Mobile Number"
                      required
                      placeholder="+91 9876543210"
                      value={signupData.mobile}
                      onChangeText={(val) => handleSignupChange('mobile', val)}
                      keyboardType="phone-pad"
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(50)}
                    />
                  </Animated.View>

                  {/* Email */}
                  <Animated.View entering={makeItemEntering(120)}>
                    <AuthInput
                      label="Email Address"
                      required
                      placeholder="user@bunkmates.com"
                      value={signupData.email}
                      onChangeText={(val) => handleSignupChange('email', val)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(110)}
                    />
                  </Animated.View>

                  {/* Username */}
                  <Animated.View entering={makeItemEntering(170)}>
                    <AuthInput
                      label="Username"
                      required
                      placeholder="@user_bunker"
                      value={signupData.username}
                      onChangeText={(val) => handleSignupChange('username', val)}
                      autoCapitalize="none"
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(170)}
                      rightLabelAction={
                        checkingUsername ? (
                          <Text style={styles.statusMuted}>Checking...</Text>
                        ) : usernameAvailable === true ? (
                          <Text style={styles.statusAvailable}>✓ Available</Text>
                        ) : usernameAvailable === false ? (
                          <Text style={styles.statusTaken}>✕ Taken</Text>
                        ) : null
                      }
                    />
                  </Animated.View>

                  {/* Password */}
                  <Animated.View entering={makeItemEntering(220)}>
                    <AuthInput
                      label="Password"
                      required
                      placeholder="••••••••"
                      value={signupData.password}
                      onChangeText={(val) => handleSignupChange('password', val)}
                      secureTextEntry
                      isPassword
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(240)}
                    />
                  </Animated.View>

                  {/* 2x2 Password Criteria */}
                  <Animated.View entering={makeItemEntering(270)}>
                    <PasswordCriteriaGrid password={signupData.password} />
                  </Animated.View>

                  {/* Confirm Password */}
                  <Animated.View entering={makeItemEntering(320)}>
                    <AuthInput
                      label="Confirm Password"
                      required
                      placeholder="••••••••"
                      value={signupData.confirmPassword}
                      onChangeText={(val) => handleSignupChange('confirmPassword', val)}
                      secureTextEntry
                      isPassword
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(340)}
                    />
                  </Animated.View>

                  {signupData.confirmPassword.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(200)} style={styles.matchIndicator}>
                      <Text
                        style={[
                          styles.matchIndicatorText,
                          { color: doSignupPasswordsMatch ? '#4ade80' : '#f87171' },
                        ]}
                      >
                        {doSignupPasswordsMatch
                          ? '✓ Passwords match'
                          : '✕ Passwords do not match'}
                      </Text>
                    </Animated.View>
                  )}

                  {/* Error Alert Banner */}
                  {error ? (
                    <Animated.View
                      entering={FadeInDown.duration(250).easing(smoothEasing)}
                      exiting={FadeOutUp.duration(200).easing(Easing.ease)}
                      style={styles.errorBanner}
                    >
                      <Ionicons
                        name="alert-circle-outline"
                        size={16}
                        color="#f87171"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                  ) : null}
                </View>

                {/* Bottom Action Buttons */}
                <View style={styles.formBottomSection}>
                  {/* JOIN CLAN BUTTON */}
                  <Animated.View entering={makeItemEntering(370)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.primaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: primaryBg,
                          marginBottom: 12,
                        },
                      ]}
                      onPress={handleEmailSignup}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={primaryText} />
                      ) : (
                        <Text style={[styles.primaryButtonText, { color: primaryText }]}>
                          JOIN CLAN
                        </Text>
                      )}
                    </AnimatedTouchableScale>
                  </Animated.View>

                  {/* OR DIVIDER */}
                  <Animated.View entering={makeItemEntering(420)} style={[styles.dividerRow, { marginVertical: 0, marginBottom: 12 }]}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </Animated.View>

                  {/* LOGIN WITH EMAIL BUTTON */}
                  <Animated.View entering={makeItemEntering(470)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.secondaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.14)',
                          backgroundColor: '#f1f1f111',
                          marginBottom: 10,
                        },
                      ]}
                      onPress={() => {
                        haptic('light');
                        setError('');
                        setViewMode('login');
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.buttonRow}>
                        <Ionicons
                          name="mail-outline"
                          size={19}
                          color="#ffffff"
                          style={styles.btnIcon}
                        />
                        <Text style={styles.secondaryButtonText}>
                          LOGIN WITH EMAIL
                        </Text>
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>

                  {/* CONTINUE WITH GOOGLE BUTTON */}
                  <Animated.View entering={makeItemEntering(520)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.primaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: primaryBg,
                        },
                      ]}
                      onPress={handleGoogleLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <View style={styles.buttonRow}>
                        <View style={styles.btnIcon}>
                          <GoogleColoredIcon size={20} />
                        </View>
                        <Text style={[styles.primaryButtonText, { color: primaryText }]}>
                          CONTINUE WITH GOOGLE
                        </Text>
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>
                </View>
              </Animated.View>
            )}

            {/* ---------------- 4. FORGOT PASSWORD VIEW ---------------- */}
            {viewMode === 'forgot-password' && (
              <Animated.View
                key="forgot-view"
                entering={FadeInDown.duration(380).easing(smoothEasing)}
                exiting={FadeOutUp.duration(220).easing(Easing.in(Easing.quad))}
                style={styles.formInner}
              >
                <View style={styles.formTop}>
                  {/* Center Floating Icon & Instruction */}
                  <Animated.View entering={makeItemEntering(30)} style={styles.iconCenterWrapper}>
                    <Animated.View style={animatedLockStyle}>
                      <MaterialCommunityIcons name="lock-reset" size={48} color={accentColor} />
                    </Animated.View>
                    <Text style={styles.recoverySubtitle}>ACCOUNT RECOVERY</Text>
                    <Text style={styles.recoveryHeading}>Reset Password</Text>
                    <Text style={styles.recoveryDescription}>
                      Enter your registered email to receive secure instructions to reset your password.
                    </Text>
                  </Animated.View>

                  <Animated.View entering={makeItemEntering(90)}>
                    <AuthInput
                      label="Email Address"
                      required
                      placeholder="user@bunkmates.com"
                      value={forgotEmail}
                      onChangeText={(val) => {
                        setForgotEmail(val);
                        if (error) setError('');
                        if (forgotMessage) setForgotMessage('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      activeTheme={activeTheme}
                      onFocus={() => handleInputFocus(0)}
                      rightLabelAction={
                        searchingProfile ? (
                          <Text style={styles.statusMuted}>Searching...</Text>
                        ) : null
                      }
                    />
                  </Animated.View>

                  {/* Verified Matched User Preview Card */}
                  {matchedUser && (
                    <Animated.View entering={makeItemEntering(150)}>
                      <UserProfileCard user={matchedUser} activeTheme={activeTheme} />
                    </Animated.View>
                  )}

                  {/* Success Message Banner */}
                  {forgotMessage ? (
                    <Animated.View entering={FadeInDown.duration(250)} style={styles.successBanner}>
                      <Ionicons
                        name="mail-outline"
                        size={17}
                        color="#4ade80"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.successText}>{forgotMessage}</Text>
                    </Animated.View>
                  ) : null}

                  {requestSent && (
                    <Animated.View entering={makeItemEntering(180)} style={{ marginTop: 6, marginBottom: 8, alignItems: 'center' }}>
                      <AnimatedTouchableScale
                        style={[styles.pasteResetLinkButton, { borderColor: `${accentColor}60` }]}
                        onPress={handlePasteResetLink}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="clipboard-outline"
                          size={16}
                          color={accentColor}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.pasteResetLinkText, { color: accentColor }]}>
                          Paste Reset Link / Code
                        </Text>
                      </AnimatedTouchableScale>
                      <Text style={styles.resetHelperNote}>
                        Tapping the link in your email on this phone will open BunkMates directly. If it opens in a web browser, copy the link and tap above.
                      </Text>
                    </Animated.View>
                  )}

                  {/* Error Alert Banner */}
                  {error ? (
                    <Animated.View
                      entering={FadeInDown.duration(250).easing(smoothEasing)}
                      exiting={FadeOutUp.duration(200).easing(Easing.ease)}
                      style={styles.errorBanner}
                    >
                      <Ionicons
                        name="alert-circle-outline"
                        size={16}
                        color="#f87171"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                  ) : null}
                </View>

                {/* Bottom Action Buttons */}
                <View style={styles.formBottomSection}>
                  <Animated.View entering={makeItemEntering(210)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.primaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          marginBottom: 10,
                        },
                        requestSent
                          ? styles.requestSentButton
                          : { backgroundColor: primaryBg },
                      ]}
                      onPress={handleSendReset}
                      disabled={loading || isBlocked || requestSent}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={primaryText} />
                      ) : requestSent ? (
                        <View style={styles.buttonRow}>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color="#4ade80"
                            style={styles.btnIcon}
                          />
                          <Text style={styles.requestSentText}>REQUEST SENT</Text>
                        </View>
                      ) : (
                        <Text style={[styles.primaryButtonText, { color: primaryText }]}>
                          SEND RESET LINK
                        </Text>
                      )}
                    </AnimatedTouchableScale>
                  </Animated.View>

                  <Animated.View entering={makeItemEntering(270)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.secondaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.14)',
                          backgroundColor: '#f1f1f111',
                        },
                      ]}
                      onPress={handleBack}
                      activeOpacity={0.85}
                    >
                      <View style={styles.buttonRow}>
                        <Ionicons
                          name="arrow-back"
                          size={16}
                          color="rgba(255, 255, 255, 0.85)"
                          style={styles.btnIcon}
                        />
                        <Text style={styles.secondaryButtonText}>Back to Login</Text>
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>
                </View>
              </Animated.View>
            )}

            {/* ---------------- 5. RESET PASSWORD VIEW ---------------- */}
            {viewMode === 'reset-password' && (
              <Animated.View
                key="reset-view"
                entering={FadeInDown.duration(380).easing(smoothEasing)}
                exiting={FadeOutUp.duration(220).easing(Easing.in(Easing.quad))}
                style={styles.formInner}
              >
                <View style={styles.formTop}>
                  {/* Center Floating Icon & Instruction */}
                  <Animated.View entering={makeItemEntering(30)} style={styles.iconCenterWrapper}>
                    <Animated.View style={animatedLockStyle}>
                      <MaterialCommunityIcons name="lock-reset" size={48} color={accentColor} />
                    </Animated.View>
                    <Text style={styles.recoverySubtitle}>ACCOUNT RECOVERY</Text>
                    <Text style={styles.recoveryHeading}>Set New Password</Text>
                    <Text style={styles.recoveryDescription}>
                      Enter your new secure password below to regain access to your clan.
                    </Text>
                  </Animated.View>

                  {/* Verifying Code Loading State */}
                  {verifyingResetCode ? (
                    <Animated.View entering={makeItemEntering(90)} style={styles.verifyingContainer}>
                      <ActivityIndicator size="small" color={accentColor} style={{ marginBottom: 12 }} />
                      <Text style={styles.verifyingText}>Verifying secure reset link...</Text>
                    </Animated.View>
                  ) : !oobCode ? (
                    /* Missing reset code */
                    <Animated.View entering={makeItemEntering(90)} style={styles.missingCodeWrapper}>
                      <Ionicons
                        name="link-outline"
                        size={36}
                        color={accentColor}
                        style={{ marginBottom: 8 }}
                      />
                      <Text style={styles.missingCodeTitle}>Reset Link Required</Text>
                      <Text style={styles.missingCodeDesc}>
                        Please open the link received in your email or paste the reset link below to update your password.
                      </Text>
                      <AnimatedTouchableScale
                        style={[
                          styles.pasteResetLinkButton,
                          {
                            borderColor: accentColor,
                            paddingVertical: 12,
                            paddingHorizontal: 20,
                            marginTop: 4,
                          },
                        ]}
                        onPress={handlePasteResetLink}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="clipboard-outline"
                          size={18}
                          color={accentColor}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[styles.pasteResetLinkText, { color: accentColor, fontSize: 14 }]}>
                          Paste Reset Link from Clipboard
                        </Text>
                      </AnimatedTouchableScale>
                    </Animated.View>
                  ) : (
                    <>
                      {/* Verified Matched User Preview Card */}
                      {resetAccountUser && (
                        <Animated.View entering={makeItemEntering(80)} style={{ marginBottom: 14 }}>
                          <UserProfileCard user={resetAccountUser} activeTheme={activeTheme} />
                        </Animated.View>
                      )}

                      {/* Success Message Banner */}
                      {resetSuccessMessage ? (
                        <Animated.View entering={FadeInDown.duration(250)} style={styles.successBanner}>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color="#4ade80"
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.successText}>{resetSuccessMessage}</Text>
                        </Animated.View>
                      ) : null}

                      {/* Password Input Fields */}
                      {resetCodeVerified !== false && (
                        <>
                          <Animated.View entering={makeItemEntering(100)}>
                            <AuthInput
                              label="New Password"
                              required
                              placeholder="••••••••"
                              value={newPassword}
                              onChangeText={(val) => {
                                setNewPassword(val);
                                if (error) setError('');
                              }}
                              secureTextEntry
                              isPassword
                              activeTheme={activeTheme}
                              onFocus={() => handleInputFocus(0)}
                            />
                          </Animated.View>

                          <Animated.View entering={makeItemEntering(140)}>
                            <PasswordCriteriaGrid password={newPassword} />
                          </Animated.View>

                          <Animated.View entering={makeItemEntering(180)}>
                            <AuthInput
                              label="Confirm New Password"
                              required
                              placeholder="••••••••"
                              value={confirmResetPassword}
                              onChangeText={(val) => {
                                setConfirmResetPassword(val);
                                if (error) setError('');
                              }}
                              secureTextEntry
                              isPassword
                              activeTheme={activeTheme}
                              onFocus={() => handleInputFocus(80)}
                            />
                          </Animated.View>

                          {confirmResetPassword.length > 0 && (
                            <Animated.View entering={FadeIn.duration(200)} style={styles.matchIndicator}>
                              <Text
                                style={[
                                  styles.matchIndicatorText,
                                  { color: doResetPasswordsMatch ? '#4ade80' : '#f87171' },
                                ]}
                              >
                                {doResetPasswordsMatch
                                  ? '✓ Passwords match'
                                  : '✕ Passwords do not match'}
                              </Text>
                            </Animated.View>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Error Alert Banner */}
                  {error ? (
                    <Animated.View
                      entering={FadeInDown.duration(250).easing(smoothEasing)}
                      exiting={FadeOutUp.duration(200).easing(Easing.ease)}
                      style={styles.errorBanner}
                    >
                      <Ionicons
                        name="alert-circle-outline"
                        size={16}
                        color="#f87171"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                  ) : null}
                </View>

                {/* Bottom Action Buttons */}
                <View style={styles.formBottomSection}>
                  {resetCodeVerified === false ? (
                    <Animated.View entering={makeItemEntering(220)}>
                      <AnimatedTouchableScale
                        style={[
                          styles.primaryButton,
                          {
                            height: 50,
                            borderRadius: 25,
                            backgroundColor: primaryBg,
                            marginBottom: 10,
                          },
                        ]}
                        onPress={() => {
                          haptic('light');
                          setError('');
                          setRequestSent(false);
                          setOobCode('');
                          setViewMode('forgot-password');
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.primaryButtonText, { color: primaryText }]}>
                          REQUEST NEW LINK
                        </Text>
                      </AnimatedTouchableScale>
                    </Animated.View>
                  ) : !oobCode || verifyingResetCode ? null : (
                    <Animated.View entering={makeItemEntering(220)}>
                      <AnimatedTouchableScale
                        style={[
                          styles.primaryButton,
                          {
                            height: 50,
                            borderRadius: 25,
                            backgroundColor: primaryBg,
                            marginBottom: 10,
                          },
                        ]}
                        onPress={handleConfirmReset}
                        disabled={loading || Boolean(resetSuccessMessage)}
                        activeOpacity={0.85}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color={primaryText} />
                        ) : (
                          <Text style={[styles.primaryButtonText, { color: primaryText }]}>
                            UPDATE PASSWORD
                          </Text>
                        )}
                      </AnimatedTouchableScale>
                    </Animated.View>
                  )}

                  <Animated.View entering={makeItemEntering(270)}>
                    <AnimatedTouchableScale
                      style={[
                        styles.secondaryButton,
                        {
                          height: 50,
                          borderRadius: 25,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.14)',
                          backgroundColor: '#f1f1f111',
                        },
                      ]}
                      onPress={handleBack}
                      activeOpacity={0.85}
                    >
                      <View style={styles.buttonRow}>
                        <Ionicons
                          name="arrow-back"
                          size={16}
                          color="rgba(255, 255, 255, 0.85)"
                          style={styles.btnIcon}
                        />
                        <Text style={styles.secondaryButtonText}>Back to Login</Text>
                      </View>
                    </AnimatedTouchableScale>
                  </Animated.View>
                </View>
              </Animated.View>
            )}

            {/* ---------------- 6. CONTINUE VIEW ---------------- */}
            {viewMode === 'continue' && (
              <Animated.View
                key="continue-view"
                entering={FadeIn.duration(450).easing(continueEasing)}
                exiting={FadeOut.duration(250)}
                style={styles.continueSection}
              >
                {/* Floating Avatar with glowing ring */}
                <Animated.View
                  entering={FadeInDown.delay(50).duration(400).easing(continueEasing)}
                  style={[styles.avatarWrapper, animatedAvatarStyle]}
                >
                  <Image
                    source={{
                      uri:
                        loggedInUser?.photoURL ||
                        getDicebearAvatar(loggedInUser?.uid || 'user'),
                    }}
                    style={[styles.continueAvatar, { borderColor: accentColor }]}
                  />
                </Animated.View>

                {/* Greeting & Welcome */}
                <Animated.View
                  entering={FadeInDown.delay(150).duration(400).easing(continueEasing)}
                  style={styles.continueGreeting}
                >
                  <Text style={styles.continueWelcomeSmall}>
                    WELCOME TO BUNKMATES
                  </Text>
                  <Text style={styles.continueName}>
                    Hey, {loggedInUser?.displayName || 'Bunker'}
                  </Text>
                  <Text style={styles.continueVibe}>
                    You're in. Bags packed. Vibes set.
                  </Text>
                </Animated.View>

                {/* Signed In As */}
                <Animated.View
                  entering={FadeInDown.delay(250).duration(400).easing(continueEasing)}
                  style={styles.signedInBox}
                >
                  <Text style={styles.signedInLabel}>SIGNED IN AS</Text>
                  <Text style={styles.signedInEmail}>
                    {loggedInUser?.email || 'user@bunkmates.com'}
                  </Text>
                </Animated.View>

                {/* Continue CTA */}
                <Animated.View
                  entering={FadeInDown.delay(350).duration(400).easing(continueEasing)}
                  style={{ width: '100%' }}
                >
                  <AnimatedTouchableScale
                    style={[
                      styles.primaryButton,
                      styles.continueButton,
                      { backgroundColor: primaryBg },
                    ]}
                    onPress={handleContinueToApp}
                    activeOpacity={0.85}
                  >
                    <View style={styles.buttonRow}>
                      <Text style={[styles.continueButtonText, { color: primaryText }]}>
                        Continue
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={primaryText}
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  </AnimatedTouchableScale>
                </Animated.View>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  ambientOrb: {
    position: 'absolute',
    top: 50,
    left: '15%',
    width: 320,
    height: 320,
    borderRadius: 160,
    zIndex: 0,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  cardWelcome: {
    justifyContent: 'flex-start',
    paddingTop: 52,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  cardForm: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: 28,
    justifyContent: 'space-between',
  },
  cardContinue: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 14,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  welcomeInner: {
    width: '100%',
  },
  formInner: {
    width: '100%',
    flex: 1,
    justifyContent: 'space-between',
  },
  formTop: {
    width: '100%',
    marginBottom: 16,
  },
  formBottomSection: {
    width: '100%',
    paddingTop: 8,
  },
  headerSection: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  backIconButton: {
    padding: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerSubtitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  forgotPassLink: {
    alignSelf: 'flex-end',
    marginTop: -2,
    marginBottom: 16,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  forgotPassText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  buttonStack: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f1f111',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  secondaryButtonText: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  createAccountButton: {
    position: 'relative',
    overflow: 'hidden',
  },
  topReflectionHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: {
    marginRight: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255, 255, 255, 0.38)',
    marginHorizontal: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  successText: {
    flex: 1,
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  requestSentButton: {
    backgroundColor: 'rgba(20, 60, 35, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  requestSentText: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#4ade80',
  },
  statusMuted: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  statusAvailable: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4ade80',
  },
  statusTaken: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#f87171',
  },
  matchIndicator: {
    marginTop: -6,
    marginBottom: 10,
    marginLeft: 4,
  },
  matchIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconCenterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  recoverySubtitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 12,
    marginBottom: 6,
  },
  recoveryHeading: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  recoveryDescription: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.68)',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  continueSection: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  avatarWrapper: {
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 26,
    elevation: 12,
  },
  continueAvatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  continueGreeting: {
    alignItems: 'center',
    marginBottom: 20,
  },
  continueWelcomeSmall: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 6,
  },
  continueName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  continueVibe: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
  },
  signedInBox: {
    alignItems: 'center',
    marginBottom: 26,
  },
  signedInLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.45)',
    marginBottom: 4,
  },
  signedInEmail: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  continueButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  continueButtonText: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pasteResetLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  pasteResetLinkText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetHelperNote: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  helperLinkText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  verifyingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  verifyingText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  missingCodeWrapper: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  missingCodeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  missingCodeDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
});