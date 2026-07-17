// hooks/useBudget.ts
import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

export interface BudgetEntry {
  id: string;
  tripId: string;
  description: string;
  amount: number;
  category: string;
  paidBy: string;
  splitWith: string[];
  date: any;
  createdAt: any;
  updatedAt: any;
}

export interface BudgetSummary {
  total: number;
  byCategory: { [key: string]: number };
  byPerson: { [key: string]: number };
  balances: { [key: string]: number };
}

export const useBudget = (tripId: string) => {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({
    total: 0,
    byCategory: {},
    byPerson: {},
    balances: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    const budgetQuery = query(
      collection(db, 'budgets'),
      where('tripId', '==', tripId)
    );

    const unsubscribe = onSnapshot(
      budgetQuery,
      (snapshot) => {
        const budgetData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as BudgetEntry[];

        setEntries(budgetData);
        calculateSummary(budgetData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching budget:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  const calculateSummary = (data: BudgetEntry[]) => {
    const total = data.reduce((sum, entry) => sum + entry.amount, 0);
    const byCategory: { [key: string]: number } = {};
    const byPerson: { [key: string]: number } = {};

    data.forEach((entry) => {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.amount;
      byPerson[entry.paidBy] = (byPerson[entry.paidBy] || 0) + entry.amount;
    });

    setSummary({
      total,
      byCategory,
      byPerson,
      balances: {},
    });
  };

  const addEntry = async (entryData: Omit<BudgetEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await addDoc(collection(db, 'budgets'), {
        ...entryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding budget entry:', error);
      throw error;
    }
  };

  const updateEntry = async (entryId: string, updates: Partial<BudgetEntry>) => {
    try {
      const entryRef = doc(db, 'budgets', entryId);
      await updateDoc(entryRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating budget entry:', error);
      throw error;
    }
  };

  const deleteEntry = async (entryId: string) => {
    try {
      await deleteDoc(doc(db, 'budgets', entryId));
    } catch (error) {
      console.error('Error deleting budget entry:', error);
      throw error;
    }
  };

  return {
    entries,
    summary,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
  };
};
