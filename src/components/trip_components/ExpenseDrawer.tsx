import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { BlurView } from "../ui/AppBlurView";
import Checkbox from "@react-native-community/checkbox";

interface Member {
  uid: string;
  photoURL?: string;
}

interface Contributor {
  uid: string;
  included: boolean;
  paidAmount: number | string;
  photoURL?: string;
}

interface Expense {
  name: string;
  amount: string;
  category: string;
  date: string;
  time: string;
  splitMode: "single_payer" | "multiple_payers";
  paidBy?: string;
}

interface Props {
  expenseDrawerOpen: boolean;
  setExpenseDrawerOpen: (v: boolean) => void;
  newExpense: Expense;
  setNewExpense: React.Dispatch<React.SetStateAction<Expense>>;
  expenseContributors: Contributor[];
  setExpenseContributors: React.Dispatch<
    React.SetStateAction<Contributor[]>
  >;
  memberDetails: Member[];
  currentUseruid: string;
  getMemberName: (uid: string) => string;
  initializeExpenseContributors: (
    members: Member[],
    mode: "single_payer" | "multiple_payers"
  ) => Contributor[];
  addExpense: () => void;
  updateExpense: () => void;
  editingExpense: boolean;
  mode: "light" | "dark";
}

const ExpenseDrawer: React.FC<Props> = ({
  expenseDrawerOpen,
  setExpenseDrawerOpen,
  newExpense,
  setNewExpense,
  expenseContributors,
  setExpenseContributors,
  memberDetails,
  currentUseruid,
  getMemberName,
  initializeExpenseContributors,
  addExpense,
  updateExpense,
  editingExpense,
  mode,
}) => {
  const isDark = mode === "dark";

  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (expenseDrawerOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [expenseDrawerOpen]);

  const disabled =
    !newExpense.name ||
    !newExpense.amount ||
    !newExpense.date ||
    !newExpense.time;

  return (
    <Modal
      visible={expenseDrawerOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setExpenseDrawerOpen(false)}
    >
      <BlurView
        intensity={35}
        tint={isDark ? "dark" : "light"}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setExpenseDrawerOpen(false)}
        />
      </BlurView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.bottomWrapper}
      >
        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: isDark
                ? "rgba(20,20,20,0.95)"
                : "rgba(255,255,255,0.95)",
              transform: [{ translateY: slideAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <View style={styles.handle} />

          <Text
            style={[
              styles.header,
              { color: isDark ? "#fff" : "#000" },
            ]}
          >
            Add New Expense
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Expense Name */}
            <TextInput
              placeholder="Expense Name"
              placeholderTextColor={isDark ? "#aaa" : "#666"}
              value={newExpense.name}
              onChangeText={(t) =>
                setNewExpense((p) => ({ ...p, name: t }))
              }
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1e1e1e" : "#fafafa",
                  color: isDark ? "#fff" : "#000",
                },
              ]}
            />

            {/* Split Mode Toggle */}
            <TouchableOpacity
              style={[
                styles.toggleButton,
                {
                  backgroundColor:
                    newExpense.splitMode === "multiple_payers"
                      ? isDark
                        ? "#ffffff15"
                        : "#00000010"
                      : "transparent",
                },
              ]}
              onPress={() => {
                const newMode =
                  newExpense.splitMode === "single_payer"
                    ? "multiple_payers"
                    : "single_payer";

                setNewExpense((p) => ({ ...p, splitMode: newMode }));
                setExpenseContributors(
                  initializeExpenseContributors(
                    memberDetails,
                    newMode
                  )
                );
              }}
            >
              <Text
                style={{
                  color: isDark ? "#fff" : "#000",
                }}
              >
                {newExpense.splitMode === "single_payer"
                  ? "Switch to Multiple Contributors"
                  : "Multiple Payers Mode"}
              </Text>
            </TouchableOpacity>

            {/* Multiple Contributors */}
            {newExpense.splitMode === "multiple_payers" &&
              expenseContributors.map((c, index) => (
                <View
                  key={c.uid}
                  style={[
                    styles.memberRow,
                    {
                      backgroundColor: c.included
                        ? isDark
                          ? "#ffffff10"
                          : "#00000010"
                        : "transparent",
                    },
                  ]}
                >
                  <Checkbox
                    value={c.included}
                    onValueChange={(checked) => {
                      setExpenseContributors((prev) =>
                        prev.map((x, i) =>
                          i === index
                            ? {
                                ...x,
                                included: checked,
                                paidAmount: checked
                                  ? x.paidAmount
                                  : 0,
                              }
                            : x
                        )
                      );
                    }}
                  />

                  {c.photoURL && (
                    <Image
                      source={{ uri: c.photoURL }}
                      style={styles.avatar}
                    />
                  )}

                  <Text
                    style={{
                      flex: 1,
                      color: isDark ? "#fff" : "#000",
                    }}
                  >
                    {getMemberName(c.uid)}
                  </Text>

                  {c.included && (
                    <TextInput
                      placeholder="Amount"
                      keyboardType="numeric"
                      value={String(c.paidAmount)}
                      onChangeText={(val) =>
                        setExpenseContributors((prev) =>
                          prev.map((x, i) =>
                            i === index
                              ? { ...x, paidAmount: val }
                              : x
                          )
                        )
                      }
                      style={[
                        styles.amountInput,
                        {
                          backgroundColor: isDark
                            ? "#1e1e1e"
                            : "#fafafa",
                          color: isDark ? "#fff" : "#000",
                        },
                      ]}
                    />
                  )}
                </View>
              ))}

            {/* Other Fields */}
            {[
              { key: "amount", label: "Amount (₹)", type: "numeric" },
              { key: "category", label: "Category", type: "default" },
              { key: "date", label: "Date", type: "default" },
              { key: "time", label: "Time", type: "default" },
            ].map((field) => (
              <TextInput
                key={field.key}
                placeholder={field.label}
                keyboardType={
                  field.type === "numeric" ? "numeric" : "default"
                }
                value={(newExpense as any)[field.key]}
                onChangeText={(val) =>
                  setNewExpense((prev) => ({
                    ...prev,
                    [field.key]: val,
                  }))
                }
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark
                      ? "#1e1e1e"
                      : "#fafafa",
                    color: isDark ? "#fff" : "#000",
                  },
                ]}
              />
            ))}

            {/* Save Button */}
            <TouchableOpacity
              disabled={disabled}
              onPress={
                editingExpense ? updateExpense : addExpense
              }
              style={[
                styles.saveButton,
                {
                  backgroundColor: isDark ? "#fff" : "#000",
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: isDark ? "#000" : "#fff",
                  fontWeight: "600",
                }}
              >
                {editingExpense
                  ? "Update Expense"
                  : "Save Expense"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ExpenseDrawer;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  drawer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#888",
    opacity: 0.5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  toggleButton: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  amountInput: {
    width: 90,
    borderRadius: 8,
    padding: 8,
  },
  saveButton: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
});