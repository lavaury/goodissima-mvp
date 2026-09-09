"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addFavorite, getFavoriteState, removeFavorite } from "@/lib/personal-favorites-actions";
import type { FavoriteTarget } from "@/lib/personal-favorite-target";
import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

type Props = {
  as?: "div" | "li" | "article";
  name: string;
  href: string | null;
  attachmentTargetId?: string;
  favorite?: FavoriteTarget;
  children: ReactNode;
  className?: string;
  "data-boussole-id"?: string;
};

/** Presentation only: both entry points use this one menu. Attachment only focuses
 * the existing confirmation form; it never submits or grants an authorization. */
export function ObjectActionRow({ as: Tag = "div", name, href, attachmentTargetId, favorite, children, className = "", ...attributes }: Props) {
  const router = useRouter();
  const [favoriteState, setFavoriteState] = useState<{ available: boolean; saved: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open || !favorite || !href) return;
    let active = true;
    setFavoriteState(null);
    getFavoriteState(favorite).then(state => { if (active) setFavoriteState(state); })
      .catch(() => { if (active) { setFavoriteState({ available: false, saved: false }); setFeedback("Favoris indisponibles. Réessayez."); } });
    return () => { active = false; };
  }, [open, favorite?.objectKind, favorite?.objectId, href]);
  const actions = [
    ...(href ? [{ id: "open", label: "Ouvrir", href }] : []),
    ...(attachmentTargetId ? [{ id: "attach", label: "Rattacher à un Workspace", href: null }] : []),
    ...(favorite && href && favoriteState?.available !== false ? [{ id: "favorite", label: !favoriteState ? "Vérification du favori…" : favoriteState.saved ? "Retirer des favoris" : "Ajouter aux favoris", href: null }] : []),
  ];
  function close(restore = true) {
    setOpen(false);
    if (restore) trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const button = trigger.current!, panel = menu.current!;
    const anchor = button.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(anchor.right - bounds.width, innerWidth - bounds.width - 8)), top: Math.max(8, Math.min(anchor.bottom + 4, innerHeight - bounds.height - 8)) });
    panel.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!panel.contains(event.target as Node) && !button.contains(event.target as Node)) close(false);
    };
    const reposition = () => close(false);
    const onScroll = () => {
      const current = button.getBoundingClientRect();
      // A scroll event queued before opening must not close the new menu.
      if (current.left !== anchor.left || current.top !== anchor.top) close(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === "Tab") { close(); return; }
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : event.key === "ArrowUp" ? (current - 1 + items.length) % items.length : null;
    if (next !== null) { event.preventDefault(); items[next]?.focus(); }
  }
  function attach() {
    close(false);
    const target = document.getElementById(attachmentTargetId!);
    target?.scrollIntoView({ block: "center" });
    (target?.querySelector<HTMLElement>("select") ?? target)?.focus({ preventScroll: true });
  }
  async function changeFavorite() {
    if (!favorite || !favoriteState?.available || pending) return;
    setPending(true);
    try {
      const removing = favoriteState.saved;
      const result = await (removing ? removeFavorite : addFavorite)(favorite);
      if (!result.ok) { setFeedback("Cet objet n’est plus disponible pour les favoris."); setFavoriteState({ available: false, saved: false }); }
      else { setFavoriteState({ available: true, saved: !removing }); setFeedback(removing ? "Favori retiré." : "Favori ajouté."); router.refresh(); }
    } catch { setFeedback("Impossible de modifier le favori. Réessayez."); }
    finally { setPending(false); close(); }
  }
  return <Tag {...attributes} data-object-action-row={actions.length ? "true" : undefined} className={`relative ${className}`} onContextMenu={actions.length ? event => {
    // Nested object rows own their context event; ordinary browser menus elsewhere remain intact.
    event.preventDefault(); event.stopPropagation(); setOpen(true);
  } : undefined}>
    {children}
    {feedback && <p role="status" className="mt-2 text-sm text-slate-600">{feedback}</p>}
    {actions.length ? <button ref={trigger} type="button" aria-label={`Actions pour ${name}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg border bg-white text-xl font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}><span aria-hidden="true">•••</span></button> : null}
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={`Actions pour ${name}`} style={position}
      className="fixed z-[100] w-56 max-w-[calc(100vw-1rem)] rounded-xl border bg-white p-1 shadow-lg" onKeyDown={keyboard}
      onClick={event => event.stopPropagation()} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
      onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close(false); }}>
      {actions.map(action => action.href ? <Link key={action.id} role="menuitem" tabIndex={-1} href={action.href} className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-sm focus:bg-slate-100 focus:outline focus:outline-2 focus:outline-cyan-700" onClick={() => close(false)}>{action.label}</Link>
        : <button key={action.id} type="button" role="menuitem" tabIndex={-1} disabled={action.id === "favorite" && (!favoriteState || pending)} className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm focus:bg-slate-100 focus:outline focus:outline-2 focus:outline-cyan-700 disabled:opacity-60" onClick={action.id === "favorite" ? changeFavorite : attach}>{action.label}</button>)}
    </div>, document.body)}
  </Tag>;
}
