"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { needsEntityContext, pageBreadcrumb, type BreadcrumbItem } from "@/lib/spatial-navigation";

type PageContext = { pathname: string; items: BreadcrumbItem[] };
const NavigationContext = createContext<{ page: PageContext | null; register: (page: PageContext) => () => void } | null>(null);

export function SpatialNavigationProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageContext | null>(null);
  const register = useCallback((next: PageContext) => {
    setPage(next);
    return () => setPage(current => current === next ? null : current);
  }, []);
  return <NavigationContext.Provider value={{ page, register }}>{children}</NavigationContext.Provider>;
}

// Rendered by authorized server pages using their existing, minimal entity data.
export function PageNavigationContext({ pathname, items }: PageContext) {
  const context = useContext(NavigationContext);
  const register = context?.register;
  useEffect(() => register?.({ pathname, items }), [register, pathname, items]);
  return null;
}

export function useBreadcrumb() {
  const pathname = usePathname();
  const context = useContext(NavigationContext);
  const resolved = context?.page?.pathname === pathname;
  return { items: resolved ? context.page!.items : pageBreadcrumb(pathname), pending: !resolved && needsEntityContext(pathname) };
}
