// Only the shell's navigation disclosures may be revealed by guidance.
// This never follows a link, clicks a control or changes business state.
export function isInClosedNavigationDisclosure(target: HTMLElement): boolean {
  let outermost: HTMLDetailsElement | null = null;
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (node.hidden || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden") return false;
    if (node instanceof HTMLDetailsElement && !node.open) {
      if (node.dataset.boussoleDisclosure !== "navigation") return false;
      outermost = node;
    }
  }
  return Boolean(outermost?.querySelector("summary")?.getClientRects().length);
}

export function revealNavigationDisclosure(target: HTMLElement): void {
  const ancestors: HTMLDetailsElement[] = [];
  for (let node = target.parentElement; node; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement && node.dataset.boussoleDisclosure === "navigation") ancestors.push(node);
  }
  // Open from outside to inside before measuring or scrolling the real target.
  ancestors.reverse().forEach(details => { details.open = true; });
}
