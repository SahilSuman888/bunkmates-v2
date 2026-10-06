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
  const { currency, formatCurrency, formatDate } = useAppSettings();
  const { t } = useLanguage();
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
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#00f721" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>{t("Track your spending")}</Text>
            <Text style={styles.headerTitle}>{t("Budget")}</Text>
          </View>
          <Pressable
            onPress={() => setShowModal(true)}
            style={styles.addButton}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{t("Total Spent")}</Text>
            <Text style={styles.statAmount}>{formatCurrency(totalExpense)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{t("Transactions")}</Text>
            <Text style={styles.statAmount}>{filteredExpenses.length}</Text>
          </View>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => setViewMode("list")}
            style={[
              styles.toggleButton,
              viewMode === "list" && styles.toggleButtonActive,
            ]}
          >
            <MaterialCommunityIcons
              name="format-list-bulleted"
              size={18}
              color={viewMode === "list" ? "#fff" : "#888"}
            />
            <Text
              style={[
                styles.toggleText,
                viewMode === "list" && styles.toggleTextActive,
              ]}
            >
              {t("List")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setViewMode("chart")}
            style={[
              styles.toggleButton,
              viewMode === "chart" && styles.toggleButtonActive,
            ]}
          >
            <MaterialCommunityIcons
              name="chart-pie"
              size={18}
              color={viewMode === "chart" ? "#fff" : "#888"}
            />
            <Text
              style={[
                styles.toggleText,
                viewMode === "chart" && styles.toggleTextActive,
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
          {["All", ...CATEGORIES.map((c) => c.name)].map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setFilterCategory(cat)}
              style={[
                styles.categoryChip,
                filterCategory === cat && styles.categoryChipActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  filterCategory === cat && styles.categoryChipTextActive,
                ]}
              >
                {t(cat)}
              </Text>
            </Pressable>
          ))}
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
                  />
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="wallet-outline"
                  size={48}
                  color="rgba(255,255,255,0.2)"
                />
                <Text style={styles.emptyText}>{t("No expenses yet")}</Text>
                <Text style={styles.emptySubtext}>{t("Add your first expense")}</Text>
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
                backgroundColor: "#0c0c0c",
                backgroundGradientFrom: "#0c0c0c",
                backgroundGradientTo: "#0c0c0c",
                color: () => "#00f721",
                labelColor: () => "#fff",
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
              color="rgba(255,255,255,0.2)"
            />
            <Text style={styles.emptyText}>{t("No data to display")}</Text>
          </View>
        )}

        {/* Add Expense Modal */}
        <Modal
          visible={showModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowModal(false)}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShowModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.modalTitle}>{t("Add Expense")}</Text>
                <Pressable onPress={addExpense}>
                  <MaterialCommunityIcons
                    name="check"
                    size={24}
                    color="#00f721"
                  />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Description */}
                <TextInput
                  style={styles.textInput}
                  placeholder={t("What did you spend on?")}
                  placeholderTextColor="#666"
                  value={description}
                  onChangeText={setDescription}
                />

                {/* Amount */}
                <TextInput
                  style={styles.textInput}
                  placeholder={`${t("Amount")} (${currency.symbol})`}
                  placeholderTextColor="#666"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />

                {/* Category Selection */}
                <Text style={styles.sectionLabel}>{t("Category")}</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.name}
                      onPress={() => setSelectedCategory(cat.name)}
                      style={[
                        styles.categoryOption,
                        {
                          borderColor:
                            selectedCategory === cat.name
                              ? cat.color
                              : "rgba(255,255,255,0.1)",
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={24}
                        color={
                          selectedCategory === cat.name ? cat.color : "#888"
                        }
                      />
                      <Text
                        style={[
                          styles.categoryOptionText,
                          {
                            color:
                              selectedCategory === cat.name ? cat.color : "#888",
                          },
                        ]}
                      >
                        {t(cat.name)}
                      </Text>
                    </Pressable>
                  ))}
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
}: {
  expense: Expense;
  category: any;
  index: number;
  onDelete: () => void;
}) {
  const { formatCurrency, formatDate } = useAppSettings();
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 30 }}
      style={styles.expenseCardWrapper}
    >
      <View style={[styles.expenseCard, { borderLeftColor: category.color }]}>
        <View
          style={[
            styles.expenseIcon,
            { backgroundColor: `${category.color}20` },
          ]}
        >
          <MaterialCommunityIcons
            name={category.icon}
            size={20}
            color={category.color}
          />
        </View>

        <View style={styles.expenseContent}>
          <Text style={styles.expenseDescription}>{expense.description}</Text>
          <Text style={styles.expenseCategory}>{expense.category}</Text>
        </View>

        <View style={styles.expenseRight}>
          <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
          <Text style={styles.expenseDate}>
            {formatDate(expense.date)}
          </Text>
        </View>

        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <MaterialCommunityIcons name="close" size={16} color="#888" />
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
