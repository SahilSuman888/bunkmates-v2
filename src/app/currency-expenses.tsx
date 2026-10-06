// **@** Currency & Expenses Settings — Pixel-perfect UI matching Settings design system with greyish-white accents, circular back button, dynamic theme adaptability (zero red), and real Firestore persistence
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Switch,
  Modal,
  TextInput,
  StatusBar,
  Appearance,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { useLanguage } from "../contexts/LanguageContext";
import { ACCENT_COLORS } from "../theme/theme";

export interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

const CURRENCIES: CurrencyItem[] = [
  { code: "USD", name: "United States Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "AED", name: "UAE Dirham", symbol: "AED", flag: "🇦🇪" },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
];

const SPLIT_METHODS = [
  {
    id: "Equally",
    title: "Equally",
    desc: "Divide expenses evenly among all group members",
  },
  {
    id: "By Exact Amounts",
    title: "By Exact Amounts",
    desc: "Specify exact amounts each member has to pay",
  },
  {
    id: "By Percentages",
    title: "By Percentages",
    desc: "Split bills by custom percentage allocation",
  },
  {
    id: "By Shares / Ratios",
    title: "By Shares / Ratios",
    desc: "Assign weighted proportions (e.g. 1x, 2x, 3x shares)",
  },
  {
    id: "By Itemized Expenses",
    title: "By Itemized Expenses",
    desc: "Assign distinct line items directly to specific individuals",
  },
];

const PRESET_GOALS = [200, 350, 450, 600, 800, 1000, 1500];

export default function CurrencyExpenses() {
  const router = useRouter();
  const { updateCurrencyPreferences } = useAppSettings();
  const { t } = useLanguage();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Currency & Expense preferences states matching reference image defaults
  const [baseCurrency, setBaseCurrency] = useState<CurrencyItem>(CURRENCIES[0]);
  const [showSymbol, setShowSymbol] = useState<boolean>(true);
  const [autoRoundOff, setAutoRoundOff] = useState<boolean>(false);
  const [splitMethod, setSplitMethod] = useState<string>("Equally");
  const [autoCategorize, setAutoCategorize] = useState<boolean>(true);
  const [savingsGoalEnabled, setSavingsGoalEnabled] = useState<boolean>(true);
  const [savingsGoalAmount, setSavingsGoalAmount] = useState<number>(450.0);

  // Modals state
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [customGoalInput, setCustomGoalInput] = useState("450.00");

  // Feedback banner state for showing real saving confirmation
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useMemo(() => new Animated.Value(0), []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  };

  // Dynamic Theme matching Settings page & ThemeContext
  let themeMode: "dark" | "light" | "system" = "system";
  let userAccent = "default";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      if (themeContext.accent) userAccent = themeContext.accent;
    }
  } catch (e) {
    // fallback
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // Dynamic colors derived from Settings page (zero red, greyish-white accents)
  const colors = useMemo(() => {
    // If user explicitly chose a custom accent that is not red/coral, respect it
    const hasCustomNonRedAccent =
      userAccent &&
      userAccent !== "default" &&
      userAccent !== "coral" &&
      userAccent !== "red" &&
      (ACCENT_COLORS as any)[userAccent];

    const customAccent = hasCustomNonRedAccent
      ? (ACCENT_COLORS as any)[userAccent]
      : null;

    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = customAccent || (isDark ? "#FFFFFF" : "#11141A");
    const activeBorder = customAccent || (isDark ? "#E2E8F0" : "#11141A");

    return {
      bg: isDark ? "#0A0A0C" : "#F4F6F9",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
      divider: isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#8E95A2" : "#7E8590",
      sectionHeader: isDark ? "#8E95A2" : "#7E8590",
      // Greyish-white icon color matching Settings page
      greyishWhite: greyishWhite,
      // Subtle neutral circular icon box matching Settings page modernIconBox
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      // Native switch colors (zero red)
      switchActive: isDark ? "#34C759" : "#10B981",
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      // Inset goal box
      insetBg: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
      insetBorder: isDark ? "rgba(255, 255, 255, 0.07)" : "#E2E8F0",
      btnBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      btnBorder: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
      activeBorder: activeBorder,
      activeText: activeText,
      searchBg: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [isDark, userAccent]);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Restore local cache & real-time Firestore sync
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_currency_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.baseCurrency) {
            const found = CURRENCIES.find((c) => c.code === parsed.baseCurrency.code);
            if (found) setBaseCurrency(found);
          }
          if (parsed.showSymbol !== undefined) setShowSymbol(parsed.showSymbol);
          if (parsed.autoRoundOff !== undefined) setAutoRoundOff(parsed.autoRoundOff);
          if (parsed.splitMethod) setSplitMethod(parsed.splitMethod);
          if (parsed.autoCategorize !== undefined) setAutoCategorize(parsed.autoCategorize);
          if (parsed.savingsGoalEnabled !== undefined) setSavingsGoalEnabled(parsed.savingsGoalEnabled);
          if (parsed.savingsGoalAmount !== undefined) {
            setSavingsGoalAmount(parsed.savingsGoalAmount);
            setCustomGoalInput(parsed.savingsGoalAmount.toFixed(2));
          }
        }
      } catch (e) {
        console.log("AsyncStorage read error:", e);
      }
    })();

    if (authLoading || !user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const uData = snap.data();
          const p = uData.currencyPreferences || {};

          if (p.baseCurrency) {
            const found = CURRENCIES.find((c) => c.code === p.baseCurrency.code || c.code === p.baseCurrency);
            if (found) setBaseCurrency(found);
          }
          if (p.showSymbol !== undefined) setShowSymbol(p.showSymbol);
          if (p.autoRoundOff !== undefined) setAutoRoundOff(p.autoRoundOff);
          if (p.splitMethod) setSplitMethod(p.splitMethod);
          if (p.autoCategorize !== undefined) setAutoCategorize(p.autoCategorize);
          if (p.savingsGoalEnabled !== undefined) setSavingsGoalEnabled(p.savingsGoalEnabled);
          if (p.savingsGoalAmount !== undefined) {
            setSavingsGoalAmount(p.savingsGoalAmount);
            setCustomGoalInput(p.savingsGoalAmount.toFixed(2));
          }
        }
      },
      (err) => {
        console.log("Currency preferences onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Sync preference helper saving to both AsyncStorage and Firestore
  const syncPreference = async (field: string, value: any) => {
    // 1. Local AppSettings & AsyncStorage cache
    updateCurrencyPreferences({ [field]: value });
    try {
      const current = await AsyncStorage.getItem("@bunkmates_currency_preferences");
      const currentObj = current ? JSON.parse(current) : {};
      currentObj[field] = value;
      await AsyncStorage.setItem("@bunkmates_currency_preferences", JSON.stringify(currentObj));
    } catch (e) {
      console.log("Failed to cache currency preference:", e);
    }

    // 2. Real-time Firestore sync
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`currencyPreferences.${field}`]: value,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log(`Failed to update currencyPreferences.${field}:`, e);
    }
  };

  // Handlers for toggles and selections
  const handleSelectCurrency = (curr: CurrencyItem) => {
    setBaseCurrency(curr);
    syncPreference("baseCurrency", curr);
    setCurrencyModalVisible(false);
    triggerToast(`Base currency set to ${curr.code}`);
  };

  const handleToggleShowSymbol = (val: boolean) => {
    setShowSymbol(val);
    syncPreference("showSymbol", val);
    triggerToast(val ? "Currency symbols enabled" : "Currency symbols hidden");
  };

  const handleToggleAutoRoundOff = (val: boolean) => {
    setAutoRoundOff(val);
    syncPreference("autoRoundOff", val);
    triggerToast(val ? "Auto round-off enabled" : "Auto round-off disabled");
  };

  const handleSelectSplitMethod = (method: string) => {
    setSplitMethod(method);
    syncPreference("splitMethod", method);
    setSplitModalVisible(false);
    triggerToast(`Default split set to ${method}`);
  };

  const handleToggleAutoCategorize = (val: boolean) => {
    setAutoCategorize(val);
    syncPreference("autoCategorize", val);
    triggerToast(val ? "AI auto-categorization enabled" : "AI categorization disabled");
  };

  const handleToggleSavingsGoal = (val: boolean) => {
    setSavingsGoalEnabled(val);
    syncPreference("savingsGoalEnabled", val);
    triggerToast(val ? "Monthly savings goal active" : "Savings goal disabled");
  };

  const handleSaveGoal = () => {
    const num = parseFloat(customGoalInput.replace(/[^0-9.]/g, ""));
    if (isNaN(num) || num < 0) {
      setCustomGoalInput(savingsGoalAmount.toFixed(2));
      setGoalModalVisible(false);
      return;
    }
    setSavingsGoalAmount(num);
    syncPreference("savingsGoalAmount", num);
    setGoalModalVisible(false);
    triggerToast(`Savings goal set to ${baseCurrency.symbol} ${num.toFixed(2)}`);
  };

  // Filtered currencies
  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return CURRENCIES;
    const q = currencySearch.toLowerCase();
    return CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Top Header: Circular button matching Settings page (modernHeaderBtn) ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {t("Currency & Expenses")}
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. BASE CURRENCY ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("Base Currency", "BASE CURRENCY")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => {
              setCurrencySearch("");
              setCurrencyModalVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Select Base Currency"
          >
            {/* Flag / Currency indicator */}
            <View style={[styles.flagBox, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
              <Text style={styles.flagText}>{baseCurrency.flag}</Text>
            </View>

            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {baseCurrency.name}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Default base for calculations
              </Text>
            </View>

            <View style={styles.rightTagWrap}>
              <Text style={[styles.currencyTagText, { color: colors.textPrimary }]}>
                {baseCurrency.code} ({baseCurrency.symbol})
              </Text>
              <Ionicons name="chevron-down" size={15} color={colors.chevron} />
            </View>
          </Pressable>
        </View>

        {/* ── 2. DISPLAY OPTIONS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("CURRENCY DISPLAY", "DISPLAY OPTIONS")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Show Currency Symbol */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="cash-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Show Currency Symbol")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Display {baseCurrency.symbol}300 instead of 300 {baseCurrency.code}
              </Text>
            </View>
            <Switch
              value={showSymbol}
              onValueChange={handleToggleShowSymbol}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Show Currency Symbol"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Auto Round Off */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="options-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Auto Round-off", "Auto Round Off")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t("Round up fractional amounts to the nearest whole number", "Round tiny fractional cents to nearest unit")}
              </Text>
            </View>
            <Switch
              value={autoRoundOff}
              onValueChange={handleToggleAutoRoundOff}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Auto Round Off"
            />
          </View>
        </View>

        {/* ── 3. EXPENSE SPLITTING ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("SPLIT BILLS DEFAULTS", "EXPENSE SPLITTING")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardIntroText, { color: colors.textSecondary }]}>
            Your default choice when adding new group logs:
          </Text>

          {/* Split Method */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setSplitModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Default Split Method"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="pie-chart-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Default Split Method", "Split Method")}</Text>
            </View>
            <Text style={[styles.rowValueText, { color: colors.textSecondary }]}>{t(splitMethod)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Auto-Categorize Expenses */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="sparkles-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Auto-Categorize Group Spends", "Auto-Categorize Expenses")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t("Automatically categorize shared expenses into food, stay, transport", "Identify flights, hostel stays & meals via AI")}
              </Text>
            </View>
            <Switch
              value={autoCategorize}
              onValueChange={handleToggleAutoCategorize}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Auto-Categorize Expenses"
            />
          </View>
        </View>

        {/* ── 4. BUDGET TRACKING ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("BUDGET & SAVINGS", "BUDGET TRACKING")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Monthly Travel Savings Goal Toggle */}
          <View style={styles.row}>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Monthly Travel Savings Goal")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t("We'll help you stash travel funds monthly", "We'll help you stash travel funds monthly")}
              </Text>
            </View>
            <Switch
              value={savingsGoalEnabled}
              onValueChange={handleToggleSavingsGoal}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Monthly Travel Savings Goal"
            />
          </View>

          {/* Inset Goal Amount Box (exact reference look) */}
          {savingsGoalEnabled && (
            <View
              style={[
                styles.goalInsetBox,
                { backgroundColor: colors.insetBg, borderColor: colors.insetBorder },
              ]}
            >
              <Text style={[styles.goalAmountText, { color: colors.textPrimary }]}>
                {showSymbol ? baseCurrency.symbol : ""}{" "}
                {autoRoundOff
                  ? Math.round(savingsGoalAmount).toLocaleString()
                  : savingsGoalAmount.toFixed(2)}
                {!showSymbol ? ` ${baseCurrency.code}` : ""}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.editGoalBtn,
                  { backgroundColor: colors.btnBg, borderColor: colors.btnBorder },
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setCustomGoalInput(savingsGoalAmount.toFixed(2));
                  setGoalModalVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit Goal"
              >
                <Text style={[styles.editGoalBtnText, { color: colors.textPrimary }]}>{t("Edit Goal", "EDIT GOAL")}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Floating Save Toast Indicator ── */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            { backgroundColor: colors.toastBg, opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* ── 1. Base Currency Modal ── */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("Select Base Currency")}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t("All group logs, split calculations and savings will be computed in this currency.", "All group logs, split calculations and savings will be computed in this currency.")}
            </Text>

            {/* Search input */}
            <View style={[styles.searchBox, { backgroundColor: colors.searchBg }]}>
              <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
              <TextInput
                value={currencySearch}
                onChangeText={setCurrencySearch}
                placeholder={t("Search currency code or country...")}
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.textPrimary }]}
                autoCapitalize="none"
              />
              {currencySearch.length > 0 && (
                <Pressable onPress={() => setCurrencySearch("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.currencyList} showsVerticalScrollIndicator={false}>
              {filteredCurrencies.map((c) => {
                const isSelected = baseCurrency.code === c.code;
                return (
                  <Pressable
                    key={c.code}
                    style={({ pressed }) => [
                      styles.currencyItemRow,
                      {
                        backgroundColor: isSelected ? colors.insetBg : "transparent",
                        borderColor: isSelected ? colors.activeBorder : colors.divider,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSelectCurrency(c)}
                  >
                    <Text style={styles.currencyFlagEmoji}>{c.flag}</Text>
                    <View style={styles.currencyItemMid}>
                      <Text style={[styles.currencyItemName, { color: colors.textPrimary }]}>{t(c.name)}</Text>
                      <Text style={[styles.currencyItemCode, { color: colors.textSecondary }]}>
                        {c.code} ({c.symbol})
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.activeBorder} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.insetBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setCurrencyModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>{t("Close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── 2. Split Method Modal ── */}
      <Modal
        visible={splitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSplitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons name="pie-chart-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("Default Split Method")}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t("Choose the primary logic applied when you record new group shared expenses.", "Choose the primary logic applied when you record new group shared expenses.")}
            </Text>

            <View style={styles.modalListColumn}>
              {SPLIT_METHODS.map((sm) => {
                const isSelected = splitMethod === sm.id;
                return (
                  <Pressable
                    key={sm.id}
                    style={({ pressed }) => [
                      styles.modalOptionItem,
                      {
                        backgroundColor: isSelected ? colors.insetBg : "transparent",
                        borderColor: isSelected ? colors.activeBorder : colors.cardBorder,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSelectSplitMethod(sm.id)}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text
                        style={[
                          styles.modalOptionText,
                          {
                            color: isSelected ? colors.activeText : colors.textPrimary,
                            fontWeight: isSelected ? "700" : "600",
                          },
                        ]}
                      >
                        {t(sm.title)}
                      </Text>
                      <Text style={[styles.modalOptionSub, { color: colors.textSecondary }]}>{t(sm.desc)}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.activeBorder} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.insetBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setSplitModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>{t("Close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── 3. Edit Savings Goal Modal ── */}
      <Modal
        visible={goalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons name="wallet-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("Edit Monthly Savings Goal")}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t("Set a monthly target to fund your upcoming adventures and bunkmate trips.", "Set a monthly target to fund your upcoming adventures and bunkmate trips.")}
            </Text>

            {/* Quick preset amount chips */}
            <View style={styles.presetChipsRow}>
              {PRESET_GOALS.map((amt) => {
                const isSelected = parseFloat(customGoalInput) === amt;
                return (
                  <Pressable
                    key={amt}
                    style={({ pressed }) => [
                      styles.presetChip,
                      {
                        backgroundColor: isSelected ? colors.insetBg : "transparent",
                        borderColor: isSelected ? colors.activeBorder : colors.cardBorder,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setCustomGoalInput(amt.toFixed(2))}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color: isSelected ? colors.activeText : colors.textPrimary,
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {baseCurrency.symbol} {amt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Numeric input */}
            <View style={[styles.goalInputWrap, { backgroundColor: colors.searchBg, borderColor: colors.cardBorder }]}>
              <Text style={[styles.goalInputPrefix, { color: colors.textPrimary }]}>{baseCurrency.symbol}</Text>
              <TextInput
                value={customGoalInput}
                onChangeText={setCustomGoalInput}
                keyboardType="numeric"
                style={[styles.goalTextInput, { color: colors.textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.goalInputSuffix, { color: colors.textSecondary }]}>{baseCurrency.code}</Text>
            </View>

            {/* Action buttons */}
            <View style={styles.modalActionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSecondaryBtn,
                  { borderColor: colors.cardBorder },
                  pressed && styles.pressed,
                ]}
                onPress={() => setGoalModalVisible(false)}
              >
                <Text style={[styles.modalCloseBtnText, { color: colors.textSecondary }]}>{t("Cancel")}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalPrimaryBtn,
                  { backgroundColor: isDark ? "#FFFFFF" : "#11141A" },
                  pressed && styles.pressed,
                ]}
                onPress={handleSaveGoal}
              >
                <Text style={[styles.modalPrimaryBtnText, { color: isDark ? "#0A0A0C" : "#FFFFFF" }]}>
                  {t("Save Goal")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  pressed: {
    opacity: 0.7,
  },

  // Header matching Settings & ProfileEdit
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 14,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    flex: 1,
  },

  // Section Heading matching Settings
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 22,
  },

  // Card matching modernCardGroup in Settings
  card: {
    marginHorizontal: 20,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  cardIntroText: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },

  // Rows inside cards
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  flagBox: {
    width: 36,
    height: 26,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  flagText: {
    fontSize: 18,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowMid: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  rightTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  currencyTagText: {
    fontSize: 14,
    fontWeight: "700",
  },
  rowValueText: {
    fontSize: 13.5,
    fontWeight: "500",
    marginRight: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // Budget Inset Box
  goalInsetBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalAmountText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  editGoalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  editGoalBtnText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  // Toast container
  toastContainer: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  searchBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    height: "100%",
  },
  currencyList: {
    width: "100%",
    maxHeight: 280,
    marginBottom: 16,
  },
  currencyItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  currencyFlagEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  currencyItemMid: {
    flex: 1,
  },
  currencyItemName: {
    fontSize: 14,
    fontWeight: "600",
  },
  currencyItemCode: {
    fontSize: 12,
    marginTop: 2,
  },
  modalListColumn: {
    width: "100%",
    gap: 8,
    marginBottom: 18,
  },
  modalOptionItem: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOptionText: {
    fontSize: 14,
  },
  modalOptionSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  presetChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12.5,
  },
  goalInputWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 6,
  },
  goalInputPrefix: {
    fontSize: 20,
    fontWeight: "700",
  },
  goalTextInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    height: "100%",
  },
  goalInputSuffix: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalActionRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalCloseBtn: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
