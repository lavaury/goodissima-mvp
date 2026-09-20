import assert from "node:assert/strict";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";

class ElementFixture {
  hidden = false;
  ariaHidden = false;
  style = { display: "block", visibility: "visible" };
  dataset: Record<string, string> = {};
  parentElement: ElementFixture | null;
  constructor(parentElement: ElementFixture | null = null) { this.parentElement = parentElement; }
  getAttribute(name: string) { return name === "aria-hidden" && this.ariaHidden ? "true" : null; }
  getClientRects() { return [1]; }
  click() { throw new Error("Guidance must never activate a control"); }
}
class DisclosureFixture extends ElementFixture {
  open = false;
  summary = new ElementFixture();
  querySelector() { return this.summary; }
}
const { isInClosedNavigationDisclosure, revealNavigationDisclosure } = loadTestModule("lib/boussole/navigation-disclosure.ts", {}, {
  HTMLDetailsElement: DisclosureFixture,
  window: { getComputedStyle: (element: ElementFixture) => element.style },
});
function fixture() {
  const outer = new DisclosureFixture();
  const inner = new DisclosureFixture(outer);
  outer.dataset.boussoleDisclosure = inner.dataset.boussoleDisclosure = "navigation";
  return { outer, inner, target: new ElementFixture(inner) };
}

test("a real link inside nested navigation disclosures stays available without opening them", () => {
  const { outer, inner, target } = fixture();
  assert.equal(isInClosedNavigationDisclosure(target), true);
  assert.equal(outer.open, false);
  assert.equal(inner.open, false);
});

test("showing a navigation target reveals its ancestors without activating it", () => {
  const { outer, inner, target } = fixture();
  revealNavigationDisclosure(target);
  assert.equal(outer.open, true);
  assert.equal(inner.open, true);
  assert.equal(isInClosedNavigationDisclosure(target), false);
});

test("unmarked business disclosures are not treated as navigation or automatically opened", () => {
  const { outer, inner, target } = fixture();
  delete inner.dataset.boussoleDisclosure;
  assert.equal(isInClosedNavigationDisclosure(target), false);
  revealNavigationDisclosure(target);
  assert.equal(inner.open, false);
  assert.equal(outer.open, true);
});

test("hidden, aria-hidden and CSS-hidden targets remain unavailable", () => {
  for (const hide of [
    (element: ElementFixture) => { element.hidden = true; },
    (element: ElementFixture) => { element.ariaHidden = true; },
    (element: ElementFixture) => { element.style.display = "none"; },
    (element: ElementFixture) => { element.style.visibility = "hidden"; },
  ]) {
    const { target } = fixture();
    hide(target);
    assert.equal(isInClosedNavigationDisclosure(target), false);
  }
});

test("a disclosure hidden by its surroundings is not an available navigation target", () => {
  const { outer, target } = fixture();
  outer.parentElement = new ElementFixture();
  outer.parentElement.hidden = true;
  assert.equal(isInClosedNavigationDisclosure(target), false);
});

test("ordinary page targets do not enter the navigation-disclosure path", () => {
  const target = new ElementFixture();
  assert.equal(isInClosedNavigationDisclosure(target), false);
  assert.doesNotThrow(() => revealNavigationDisclosure(target));
});
