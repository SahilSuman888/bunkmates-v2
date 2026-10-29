import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  Modal,
  Alert,
  FlatList,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import Animated, { FadeIn } from "./reanimatedShim";
// ...existing code...
import { MotiView } from "moti";
import { BarChart, PieChart } from "react-native-chart-kit";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeToggle } from "../contexts/ThemeContext";

const { width } = Dimensions.get("window");

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  userId: string;
}

const CATEGORIES = [
  { name: "Food", icon: "restaurant", color: "#ff9c00" },
  { name: "Transport", icon: "car", color: "#2196f3" },
  { name: "Rent", icon: "home", color: "#4caf50" },
  { name: "Utilities", icon: "lightning-bolt", color: "#ff9800" },
  { name: "Shopping", icon: "shopping-bag", color: "#e91e63" },
  { name: "Entertainment", icon: "movie", color: "#9c27b0" },
  { name: "Medical", icon: "hospital-box", color: "#f44336" },
  { name: "Education", icon: "school", color: "#3f51b5" },
  { name: "Other", icon: "dots-horizontal", color: "#757575" },
];

export default function BudgetScreen() {
  const {
    currency,
    formatCurrency,
    formatDate,
    savingsGoalEnabled,
    savingsGoalAmount,
    autoCategorize,
  } = useAppSettings();
  const { t } = useLanguage();
  const { themeColors, isDark, accentColor, onAccentTextColor, scaleFont, background } = useThemeToggle();
  const isAtmosphere = background.mode !== "solid";
  const [authInitialized, setAuthInitialized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Food");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");

  const detectCategory = (text: string): string | null => {
    const lower = text.toLowerCase();
    if (lower.match(/\b(food|lunch|dinner|breakfast|snack|coffee|cafe|pizza|burger|starbucks|restaurant|eat|tea|grocer|meal|drink)\b/)) return "Food";
    if (lower.match(/\b(uber|taxi|cab|flight|train|bus|metro|gas|petrol|diesel|fuel|parking|toll|transit|fare|drive)\b/)) return "Transport";
    if (lower.match(/\b(rent|hotel|hostel|airbnb|stay|room|apartment|dorm|booking)\b/)) return "Rent";
    if (lower.match(/\b(electric|power|water|bill|wifi|internet|recharge|sim|gas\s*bill|utility)\b/)) return "Utilities";
    if (lower.match(/\b(shop|cloth|dress|shirt|shoes|mall|amazon|store|buy|purchase)\b/)) return "Shopping";
    if (lower.match(/\b(movie|cinema|netflix|concert|club|party|game|bar|pub|show|beer|alcohol)\b/)) return "Entertainment";
    if (lower.match(/\b(med|doctor|hospital|pharmacy|pill|health|clinic|dentist|drug)\b/)) return "Medical";
    if (lower.match(/\b(book|course|school|college|tuition|class|exam|study|lecture)\b/)) return "Education";
    return null;
  };

  // ═══════════════════════════════════════════════════════════════
  // AUTH & DATA FETCHING
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthInitialized(true);
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authInitialized || !user) return;

    const expensesQuery = query(
      collection(db, "expenses"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      const fetchedExpenses: Expense[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const expenseDate = data.date?.toDate?.() || new Date(data.date);
        fetchedExpenses.push({
          id: doc.id,
          description: data.description || "Expense",
          amount: data.amount || 0,
          category: data.category || "Other",
          date: expenseDate,
          userId: data.userId,
        });
      });

      // Sort by date (newest first)
      fetchedExpenses.sort((a, b) => b.date.getTime() - a.date.getTime());
      setExpenses(fetchedExpenses);
    });

    return () => unsubscribe();
  }, [authInitialized, user]);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const addExpense = async () => {
    if (!user || !description.trim() || !amount.trim()) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      await addDoc(collection(db, "expenses"), {
        description,
        amount: parseFloat(amount),
        category: selectedCategory,
        date: new Date(),
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setDescription("");
      setAmount("");
      setSelectedCategory("Food");
      setShowModal(false);
    } catch (error) {
      console.error("Error adding expense:", error);
      Alert.alert("Error", "Failed to add expense");
    }
  };

  const deleteExpense = async (expenseId: string) => {
    Alert.alert("Delete Expense", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "expenses", expenseId));
          } catch (error) {
            console.error("Error deleting expense:", error);
          }
        },
      },
    ]);
  };

  // ═══════════════════════════════════════════════════════════════
  // CALCULATIONS
  // ═══════════════════════════════════════════════════════════════

  const filteredExpenses = useMemo(() => {
    return filterCategory === "All"
      ? expenses
      : expenses.filter((e) => e.category === filterCategory);
  }, [expenses, filterCategory]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const categoryTotals = useMemo(() => {
    const totals: { [key: string]: number } = {};
    CATEGORIES.forEach((cat) => {
      totals[cat.name] = 0;
    });
    expenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
  }, [expenses]);

  const chartData = useMemo(() => {
    const labels = CATEGORIES.filter((c) => categoryTotals[c.name] > 0).map(
      (c) => c.name.substring(0, 3)
    );
    const data = CATEGORIES.filter((c) => categoryTotals[c.name] > 0).map(
      (c) => categoryTotals[c.name]
    );
    return { labels, data };
  }, [categoryTotals]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: isAtmosphere ? "transparent" : themeColors.background }]}>
        <View style={[styles.container, styles.centerContent, { backgroundColor: "transparent" }]}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isAtmosphere ? "transparent" : themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomWidth: 0 }]}>
          <View>
            <Text style={[styles.headerSub, { color: themeColors.textSecondary, fontSize: scaleFont(13) }]}>{t("Track your spending")}</Text>
            <Text style={[styles.headerTitle, { color: themeColors.text, fontSize: scaleFont(28) }]}>{t("Budget")}</Text>
          </View>
          <Pressable
            onPress={() => setShowModal(true)}
            style={[styles.addButton, { backgroundColor: accentColor }]}
          >
            <MaterialCommunityIcons name="plus" size={20} color={onAccentTextColor} />
          </Pressable>
        </View>

        {/* Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: themeColors.card, borderWidth: 0 }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary, fontSize: scaleFont(11) }]}>{t("Total Spent")}</Text>
            <Text style={[styles.statAmount, { color: themeColors.accentText, fontSize: scaleFont(18) }]}>{formatCurrency(totalExpense)}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary, fontSize: scaleFont(11) }]}>{t("Transactions")}</Text>
            <Text style={[styles.statAmount, { color: themeColors.text, fontSize: scaleFont(18) }]}>{filteredExpenses.length}</Text>
          </View>
        </View>

        {/* Savings / Budget Goal Progress Card (when enabled in Settings) */}
        {savingsGoalEnabled && savingsGoalAmount > 0 && (
          <View
            style={{
              backgroundColor: themeColors.card,
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: totalExpense > savingsGoalAmount ? "rgba(239, 68, 68, 0.4)" : "transparent",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialCommunityIcons
                  name={totalExpense > savingsGoalAmount ? "alert-circle" : "shield-check"}
                  size={16}
                  color={totalExpense > savingsGoalAmount ? "#ef4444" : "#10b981"}
                />
                <Text style={{ color: themeColors.text, fontSize: scaleFont(13), fontWeight: "700" }}>
                  {t("Monthly Budget Goal")}
                </Text>
              </View>
              <Text style={{ color: themeColors.textSecondary, fontSize: scaleFont(12) }}>
                {formatCurrency(totalExpense)} / {formatCurrency(savingsGoalAmount)}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={{ height: 6, backgroundColor: isDark ? "#28282c" : "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.round((totalExpense / savingsGoalAmount) * 100))}%`,
                  backgroundColor: totalExpense > savingsGoalAmount ? "#ef4444" : (accentColor || "#38bdf8"),
                  borderRadius: 3,
                }}
              />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ color: totalExpense > savingsGoalAmount ? "#ef4444" : themeColors.textSecondary, fontSize: scaleFont(11), fontWeight: "600" }}>
                {totalExpense > savingsGoalAmount
                  ? `${t("Over budget by")} ${formatCurrency(totalExpense - savingsGoalAmount)}`
                  : `${t("Remaining")}: ${formatCurrency(savingsGoalAmount - totalExpense)}`}
              </Text>
              <Text style={{ color: themeColors.textSecondary, fontSize: scaleFont(11) }}>
                {Math.round((totalExpense / savingsGoalAmount) * 100)}%
              </Text>
            </View>
          </View>
        )}

        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => setViewMode("list")}
            style={[
              styles.toggleButton,
              { backgroundColor: viewMode === "list" ? accentColor : (isDark ? "#202024" : "#F4F5F7"), borderWidth: 0 },
            ]}
          >
            <MaterialCommunityIcons
              name="format-list-bulleted"
              size={18}
              color={viewMode === "list" ? "#fff" : themeColors.textSecondary}
            />
            <Text
              style={[
                styles.toggleText,
                { color: viewMode === "list" ? "#fff" : themeColors.textSecondary, fontSize: scaleFont(12) },
              ]}
            >
              {t("List")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setViewMode("chart")}
            style={[
              styles.toggleButton,
              { backgroundColor: viewMode === "chart" ? accentColor : (isDark ? "#202024" : "#F4F5F7"), borderWidth: 0 },
            ]}
          >
            <MaterialCommunityIcons
              name="chart-pie"
              size={18}
              color={viewMode === "chart" ? "#fff" : themeColors.textSecondary}
            />
            <Text
              style={[
                styles.toggleText,
                { color: viewMode === "chart" ? "#fff" : themeColors.textSecondary, fontSize: scaleFont(12) },
              ]}
            >
              {t("Chart")}
            </Text>
          </Pressable>
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {["All", ...CATEGORIES.map((c) => c.name)].map((cat) => {
            const isActive = filterCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setFilterCategory(cat)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isActive ? accentColor : (isDark ? "#202024" : "#F4F5F7"),
                    borderWidth: 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color: isActive ? "#fff" : themeColors.textSecondary,
                      fontSize: scaleFont(12),
                    },
                  ]}
                >
                  {t(cat)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Content View */}
        {viewMode === "list" ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredExpenses.length > 0 ? (
              filteredExpenses.map((expense, index) => {
                const category = CATEGORIES.find(
                  (c) => c.name === expense.category
                );
                return (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    category={category!}
                    index={index}
                    onDelete={() => deleteExpense(expense.id)}
                    themeColors={themeColors}
                    accentColor={accentColor}
                    scaleFont={scaleFont}
                  />
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="wallet-outline"
                  size={48}
                  color={themeColors.textSecondary}
                />
                <Text style={[styles.emptyText, { color: themeColors.text, fontSize: scaleFont(16) }]}>{t("No expenses yet")}</Text>
                <Text style={[styles.emptySubtext, { color: themeColors.textSecondary, fontSize: scaleFont(13) }]}>{t("Add your first expense")}</Text>
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        ) : chartData.data.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.chartContainer}
            showsVerticalScrollIndicator={false}
          >
            <PieChart
              data={{
                labels: chartData.labels,
                datasets: [{ data: chartData.data }],
              } as any}
              width={width - 32}
              height={300}
              chartConfig={{
                backgroundColor: themeColors.card,
                backgroundGradientFrom: themeColors.card,
                backgroundGradientTo: themeColors.card,
                color: () => accentColor,
                labelColor: () => themeColors.text,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
            />
            <View style={{ height: 20 }} />
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="chart-pie-outline"
              size={48}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: themeColors.text, fontSize: scaleFont(16) }]}>{t("No data to display")}</Text>
          </View>
        )}

        {/* Add Expense Modal */}
        <Modal
          visible={showModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowModal(false)}
        >
          <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: isAtmosphere ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.5)" }]}>
            <View style={[styles.modalContainer, { backgroundColor: themeColors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
              <View style={[styles.modalHeader, { borderBottomWidth: 0 }]}>
                <Pressable onPress={() => setShowModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={themeColors.text} />
                </Pressable>
                <Text style={[styles.modalTitle, { color: themeColors.text, fontSize: scaleFont(18) }]}>{t("Add Expense")}</Text>
                <Pressable onPress={addExpense}>
                  <MaterialCommunityIcons
                    name="check"
                    size={24}
                    color={accentColor}
                  />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Description */}
                <TextInput
                  style={[styles.textInput, { backgroundColor: isDark ? "#202024" : "#F4F5F7", color: themeColors.text, borderRadius: 12, paddingHorizontal: 14, borderWidth: 0 }]}
                  placeholder={t("What did you spend on?")}
                  placeholderTextColor={themeColors.textSecondary}
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (autoCategorize) {
                      const detected = detectCategory(text);
                      if (detected) setSelectedCategory(detected);
                    }
                  }}
                />

                {/* Amount */}
                <TextInput
                  style={[styles.textInput, { backgroundColor: isDark ? "#202024" : "#F4F5F7", color: themeColors.text, borderRadius: 12, paddingHorizontal: 14, borderWidth: 0 }]}
                  placeholder={`${t("Amount")} (${currency.symbol})`}
                  placeholderTextColor={themeColors.textSecondary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />

                {/* Category Selection */}
                <Text style={[styles.sectionLabel, { color: themeColors.textSecondary, fontSize: scaleFont(13) }]}>{t("Category")}</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => {
                    const isCatActive = selectedCategory === cat.name;
                    return (
                      <Pressable
                        key={cat.name}
                        onPress={() => setSelectedCategory(cat.name)}
                        style={[
                          styles.categoryOption,
                          {
                            backgroundColor: isCatActive ? `${accentColor}18` : (isDark ? "#202024" : "#F4F5F7"),
                            borderWidth: 0,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={cat.icon as any}
                          size={24}
                          color={
                            isCatActive ? accentColor : themeColors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.categoryOptionText,
                            {
                              color: isCatActive ? accentColor : themeColors.textSecondary,
                              fontSize: scaleFont(10),
                            },
                          ]}
                        >
                          {t(cat.name)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
// EXPENSE CARD
// ════════════════════════════════════════════════════════════════

function ExpenseCard({
  expense,
  category,
  index,
  onDelete,
  themeColors,
  accentColor,
  scaleFont,
}: {
  expense: Expense;
  category: any;
  index: number;
  onDelete: () => void;
  themeColors: any;
  accentColor: string;
  scaleFont: (size: number) => number;
}) {
  const { formatCurrency, formatDate } = useAppSettings();
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 30 }}
      style={styles.expenseCardWrapper}
    >
      <View style={[styles.expenseCard, { backgroundColor: themeColors.card, borderLeftColor: category?.color || accentColor, borderLeftWidth: 3, borderWidth: 0 }]}>
        <View
          style={[
            styles.expenseIcon,
            { backgroundColor: `${category?.color || accentColor}20` },
          ]}
        >
          <MaterialCommunityIcons
            name={category?.icon || "currency-usd"}
            size={20}
            color={category?.color || accentColor}
          />
        </View>

        <View style={styles.expenseContent}>
          <Text style={[styles.expenseDescription, { color: themeColors.text, fontSize: scaleFont(14) }]}>{expense.description}</Text>
          <Text style={[styles.expenseCategory, { color: themeColors.textSecondary, fontSize: scaleFont(11) }]}>{expense.category}</Text>
        </View>

        <View style={styles.expenseRight}>
          <Text style={[styles.expenseAmount, { color: themeColors.accentText, fontSize: scaleFont(14) }]}>{formatCurrency(expense.amount)}</Text>
          <Text style={[styles.expenseDate, { color: themeColors.textSecondary, fontSize: scaleFont(10) }]}>
            {formatDate(expense.date)}
          </Text>
        </View>

        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <MaterialCommunityIcons name="close" size={16} color={themeColors.textSecondary} />
        </Pressable>
      </View>
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  container: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerSub: {
    fontSize: 13,
    fontWeight: "500",
    color: "#BDBDBD",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  statsCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "rgba(0,247,33,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,247,33,0.2)",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#BDBDBD",
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00f721",
  },

  viewToggle: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
  },
  toggleButtonActive: {
    backgroundColor: "rgba(0,247,33,0.2)",
    borderWidth: 1,
    borderColor: "#00f721",
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
  },
  toggleTextActive: {
    color: "#00f721",
  },

  categoryScroll: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryContent: {
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
  },
  categoryChipActive: {
    backgroundColor: "#00f721",
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
  },
  categoryChipTextActive: {
    color: "#000",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  chartContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  expenseCardWrapper: {
    marginBottom: 12,
  },
  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 12,
    gap: 12,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  expenseContent: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  expenseCategory: {
    fontSize: 11,
    color: "#888",
  },
  expenseRight: {
    alignItems: "flex-end",
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00f721",
  },
  expenseDate: {
    fontSize: 10,
    color: "#888",
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#888",
    marginTop: 6,
  },

  modalSafeArea: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  textInput: {
    fontSize: 16,
    color: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.2)",
    marginBottom: 16,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#BDBDBD",
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryOption: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryOptionText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
});
