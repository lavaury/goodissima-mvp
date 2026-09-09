import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import { loadTestModule } from "./load-test-module.ts";

export const objectActionRow = loadTestModule("components/ObjectActionRow.tsx", {
  react: React, "react/jsx-runtime": jsx, "react-dom": ReactDOM,
  "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }),
  "next/navigation": { useRouter: () => ({ refresh() {} }) },
  "@/lib/personal-favorites-actions": { getFavoriteState: async () => ({ available: true, saved: false }), addFavorite: async () => ({ ok: true }), removeFavorite: async () => ({ ok: true }) },
});
