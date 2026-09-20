/** Only reveals a real Portfolio's child list. Never clicks or follows a link. */
export function isInClosedPortfolio(target: HTMLElement): boolean {
  let panel: HTMLElement | null = null;
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    const permitted = node.dataset.boussolePortfolioContent === "true" && node.parentElement?.dataset.boussolePortfolio === "true";
    const style = window.getComputedStyle(node);
    if ((node.hidden || style.display === "none") && !permitted) return false;
    if (style.visibility === "hidden" || node.getAttribute("aria-hidden") === "true") return false;
    if (permitted && node.hidden) panel = node;
  }
  return Boolean(panel?.parentElement?.querySelector("button[aria-expanded]")?.getClientRects().length);
}
export function revealPortfolio(target: HTMLElement): void {
  const root = target.closest<HTMLElement>('[data-boussole-portfolio="true"]');
  if (root?.querySelector<HTMLElement>('[data-boussole-portfolio-content="true"]')?.hidden)
    root.dispatchEvent(new Event("boussole:reveal-portfolio"));
}
