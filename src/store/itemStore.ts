import { create } from "zustand";

export interface Item {
  id: number;
  category: string;
  condition: string;
  sellerQuotedPrice: number;
  finalPayout: number;
  repairCost: number;
  sellingPrice: number;
  status: string;
  currentBranch: string;
  sellerName: string;
  buyerName?: string;
}

interface ItemStore {
  items: Item[];
  addItem: (data: { category: string; condition: string; sellerQuotedPrice: number; sellerName: string }) => void;
  processItem: (id: number, data: { finalPayout: number; decision: string; repairCost?: number; sellingPrice?: number }) => void;
  buyItem: (id: number, buyerName: string) => void;
  calculateFinancials: () => { revenue: number; cost: number; profit: number };
}

export const useItemStore = create<ItemStore>((set, get) => ({
  items: [],

  addItem: (data) => {
    const newItem: Item = {
      id: get().items.length + 1,
      category: data.category,
      condition: data.condition,
      sellerQuotedPrice: data.sellerQuotedPrice,
      finalPayout: 0,
      repairCost: 0,
      sellingPrice: 0,
      status: "REQUEST: Awaiting Valuation",
      currentBranch: "N/A",
      sellerName: data.sellerName,
    };
    set((state) => ({ items: [...state.items, newItem] }));
  },

  processItem: (id, data) => {
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, finalPayout: data.finalPayout };

          if (data.decision === "recycle") {
            updated.status = "Recycled";
            updated.currentBranch = "Recycle";
            updated.sellingPrice = 150;
          } else if (data.decision === "refurbish") {
            updated.status = "Ready to Sell";
            updated.currentBranch = "Refurbish & Sell";
            updated.repairCost = data.repairCost || 0;
            updated.sellingPrice = data.sellingPrice || 0;
          } else if (data.decision === "scrap") {
            updated.status = "Scrapped";
            updated.currentBranch = "Scrap/Not Usable";
          }

          return updated;
        }
        return item;
      }),
    }));
  },

  buyItem: (id, buyerName) => {
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id === id && item.status === "Ready to Sell") {
          return { ...item, status: "Sold", buyerName };
        }
        return item;
      }),
    }));
  },

  calculateFinancials: () => {
    const items = get().items;
    let revenue = 0;
    let cost = 0;

    items.forEach((item) => {
      if (item.status === "Sold") {
        revenue += item.sellingPrice;
        cost += item.finalPayout + item.repairCost;
      } else if (item.status === "Recycled") {
        revenue += 150;
        cost += item.finalPayout;
      } else if (item.finalPayout > 0) {
        cost += item.finalPayout + item.repairCost;
      }
    });

    return { revenue, cost, profit: revenue - cost };
  },
}));
