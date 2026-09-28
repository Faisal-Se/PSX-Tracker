"use client";

import { create } from "zustand";

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  /** Set for the accounts allowed to see the user list. */
  isAdmin?: boolean;
}

const HIDE_KEY = "psx-hide-balances";

function initialHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

interface AppStore {
  user: User | null;
  setUser: (user: User | null) => void;
  selectedPortfolioId: string | null;
  setSelectedPortfolioId: (id: string | null) => void;

  /** Global "hide balances" — blurs money figures across the whole app. */
  balancesHidden: boolean;
  toggleBalances: () => void;
  setBalancesHidden: (hidden: boolean) => void;
}

export const useStore = create<AppStore>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  selectedPortfolioId: null,
  setSelectedPortfolioId: (id) => set({ selectedPortfolioId: id }),

  balancesHidden: initialHidden(),
  toggleBalances: () => get().setBalancesHidden(!get().balancesHidden),
  setBalancesHidden: (hidden) => {
    try {
      localStorage.setItem(HIDE_KEY, hidden ? "1" : "0");
    } catch {}
    set({ balancesHidden: hidden });
  },
}));
