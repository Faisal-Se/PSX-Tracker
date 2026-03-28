"use client";

import { create } from "zustand";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AppStore {
  user: User | null;
  setUser: (user: User | null) => void;
  selectedPortfolioId: string | null;
  setSelectedPortfolioId: (id: string | null) => void;
}

export const useStore = create<AppStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  selectedPortfolioId: null,
  setSelectedPortfolioId: (id) => set({ selectedPortfolioId: id }),
}));
