/**
 * Firefox 113 compatibility for `:has()`.
 *
 * Firefox only enabled the CSS `:has()` selector in version 121. The Spotamp
 * stylesheet uses it for structural Spotify DOM states (playing rows, shortcut
 * cards, the now-playing panel wrapper and so on). On older Firefox those
 * rules are simply dropped.
 *
 * This module rewrites every `:has(relative-selector)` into an attribute marker
 * (`[data-spotamp-has~="h0"]`) and maintains those markers from JavaScript with
 * a MutationObserver. It covers the relative selectors used by Spotamp:
 * descendant, child (`>`), next-sibling (`+`) and subsequent-sibling (`~`)
 * combinators, plus selector lists inside the parentheses.
 *
 * Browsers with native `:has()` support never call the transform or runtime.
 */

export const HAS_MARKER_ATTRIBUTE = "data-spotamp-has";

const HAS_PSEUDO = ":has(";
const MARKER_PREFIX = `[${HAS_MARKER_ATTRIBUTE}~="`;

type Combinator = " " | ">" | "+" | "~";

interface ComplexPart {
  /** The combinator that connects this compound to the previous one. */
  combinator: Combinator;
  selector: string;
}

interface RelativeSelector {
  /** The combinator that connects the first compound to the element being marked. */
  combinator: Combinator;
  parts: ComplexPart[];
}

export interface HasRule {
  id: string;
  /** One entry per top-level comma in the `:has()` argument. */
  relatives: string[];
}

export interface HasTransformResult {
  cssText: string;
  rules: HasRule[];
  changed: boolean;
}

/** True when the browser can evaluate `:has()` itself (Firefox 121+). */
export function supportsNativeHas(win: Window): boolean {
  try {
    const css = (
      win as Window & { CSS?: { supports?: (condition: string) => boolean } }
    ).CSS;
    return typeof css?.supports === "function" && css.supports("selector(:has(*))");
  } catch {
    return false;
  }
}

/**
 * Replace each `:has()` occurrence with a marker attribute selector. Comments
 * and quoted strings are skipped so `content: ":has(x)"` is left alone.
 */
export function transformHasSelectors(cssText: string): HasTransformResult {
  if (!cssText.toLowerCase().includes(HAS_PSEUDO)) {
    return { cssText, rules: [], changed: false };
  }

  const rules: HasRule[] = [];
  const ids = new Map<string, string>();
  let output = "";
  let index = 0;

  while (index < cssText.length) {
    const ch = cssText.charAt(index);

    if (ch === "/" && cssText.charAt(index + 1) === "*") {
      const end = cssText.indexOf("*/", index + 2);
      const stop = end === -1 ? cssText.length : end + 2;
      output += cssText.slice(index, stop);
      index = stop;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const stop = skipString(cssText, index, ch);
      output += cssText.slice(index, stop);
      index = stop;
      continue;
    }

    if (cssText.slice(index, index + HAS_PSEUDO.length).toLowerCase() === HAS_PSEUDO) {
      const argumentStart = index + HAS_PSEUDO.length;
      const argumentEnd = findClosingParen(cssText, argumentStart);
      if (argumentEnd === -1) {
        output += ch;
        index += 1;
        continue;
      }

      const relatives = splitTopLevel(
        cssText.slice(argumentStart, argumentEnd),
        ",",
      )
        .map((part) => part.trim())
        .filter(Boolean);

      if (relatives.length === 0) {
        output += ch;
        index += 1;
        continue;
      }

      const key = relatives.join(",");
      let id = ids.get(key);
      if (!id) {
        id = `h${rules.length}`;
        ids.set(key, id);
        rules.push({ id, relatives });
      }

      output += `${MARKER_PREFIX}${id}"]`;
      index = argumentEnd + 1;
      continue;
    }

    output += ch;
    index += 1;
  }

  return { cssText: output, rules, changed: rules.length > 0 };
}

/**
 * Keeps `data-spotamp-has` markers in sync with the live Spotify DOM.
 * Call `start()` after the stylesheet is installed and `stop()` when Spotamp
 * is disabled.
 */
export class HasSelectorRuntime {
  private readonly doc: Document;
  private readonly win: Window;
  private readonly rules: HasRule[];
  private observer: MutationObserver | null = null;
  private interval: number | null = null;
  private refreshTimer: number | null = null;
  private marked = new Map<Element, Set<string>>();
  private running = false;

  constructor(doc: Document, win: Window, rules: HasRule[]) {
    this.doc = doc;
    this.win = win;
    this.rules = rules;
  }

  start(): void {
    if (this.running || this.rules.length === 0) return;
    this.running = true;

    if (typeof MutationObserver !== "undefined" && this.doc.documentElement) {
      this.observer = new MutationObserver((records) => this.onMutations(records));
      this.observer.observe(this.doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    // Attribute changes such as `aria-current` and `aria-label` drive most of
    // the markers. The observer catches them; the interval is a cheap safety
    // net for changes made while a MutationObserver batch is being coalesced.
    this.interval = this.win.setInterval(() => this.schedule(), 1000);
    this.refresh();
  }

  stop(): void {
    if (!this.running && this.marked.size === 0) return;
    this.running = false;
    this.observer?.disconnect();
    this.observer = null;
    if (this.interval != null) {
      this.win.clearInterval(this.interval);
      this.interval = null;
    }
    if (this.refreshTimer != null) {
      this.win.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.clearMarkers();
  }

  /** Recompute every marker. Exposed for tests and for the periodic fallback. */
  refresh(): void {
    if (!this.running) return;

    const next = new Map<Element, Set<string>>();
    for (const rule of this.rules) {
      for (const relative of rule.relatives) {
        for (const element of resolveRelative(this.doc, relative)) {
          let ids = next.get(element);
          if (!ids) {
            ids = new Set<string>();
            next.set(element, ids);
          }
          ids.add(rule.id);
        }
      }
    }

    const elements = new Set<Element>([
      ...this.marked.keys(),
      ...next.keys(),
    ]);

    for (const element of elements) {
      const oldIds = this.marked.get(element);
      const newIds = next.get(element);

      if (!newIds || newIds.size === 0) {
        if (oldIds) element.removeAttribute(HAS_MARKER_ATTRIBUTE);
        this.marked.delete(element);
        continue;
      }

      if (!oldIds || !sameSet(oldIds, newIds)) {
        element.setAttribute(
          HAS_MARKER_ATTRIBUTE,
          Array.from(newIds).sort().join(" "),
        );
        this.marked.set(element, new Set(newIds));
      }
    }
  }

  private onMutations(records: MutationRecord[]): void {
    if (!this.running) return;
    for (const record of records) {
      if (record.type === "attributes") {
        const name = record.attributeName;
        // Our own writes and Spotify's constantly changing progress styles do
        // not affect any `:has()` argument. Ignoring them avoids a refresh
        // loop and keeps scrolling/playback from thrashing the marker pass.
        if (!name || name === HAS_MARKER_ATTRIBUTE || name === "style") continue;
      }
      this.schedule();
      return;
    }
  }

  private schedule(): void {
    if (!this.running || this.refreshTimer != null) return;
    this.refreshTimer = this.win.setTimeout(() => {
      this.refreshTimer = null;
      this.refresh();
    }, 120);
  }

  private clearMarkers(): void {
    for (const element of this.marked.keys()) {
      element.removeAttribute(HAS_MARKER_ATTRIBUTE);
    }
    this.marked.clear();
  }
}

function resolveRelative(doc: Document, raw: string): Element[] {
  const relative = parseRelativeSelector(raw);
  if (!relative || relative.parts.length === 0) return [];

  const parts = relative.parts;
  const last = parts[parts.length - 1];
  if (!last) return [];

  let current: Element[];
  try {
    current = Array.from(doc.querySelectorAll(last.selector));
  } catch {
    return [];
  }

  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const earlier = parts[index];
    const relation = parts[index + 1]?.combinator ?? " ";
    if (!earlier) continue;

    const matches: Element[] = [];
    for (const element of current) {
      for (const candidate of relatedElements(element, relation)) {
        if (matchesSelector(candidate, earlier.selector)) {
          matches.push(candidate);
        }
      }
    }

    current = Array.from(new Set(matches));
    if (current.length === 0) return [];
  }

  const affected: Element[] = [];
  for (const element of current) {
    if (relative.combinator === ">") {
      const parent = element.parentElement;
      if (parent) affected.push(parent);
    } else if (relative.combinator === "+") {
      const sibling = element.previousElementSibling;
      if (sibling) affected.push(sibling);
    } else if (relative.combinator === "~") {
      let sibling = element.previousElementSibling;
      while (sibling) {
        affected.push(sibling);
        sibling = sibling.previousElementSibling;
      }
    } else {
      let ancestor = element.parentElement;
      while (ancestor) {
        affected.push(ancestor);
        ancestor = ancestor.parentElement;
      }
    }
  }

  return Array.from(new Set(affected));
}

function relatedElements(element: Element, combinator: Combinator): Element[] {
  if (combinator === ">") {
    return element.parentElement ? [element.parentElement] : [];
  }
  if (combinator === "+") {
    return element.previousElementSibling ? [element.previousElementSibling] : [];
  }
  if (combinator === "~") {
    const siblings: Element[] = [];
    let sibling = element.previousElementSibling;
    while (sibling) {
      siblings.push(sibling);
      sibling = sibling.previousElementSibling;
    }
    return siblings;
  }

  const ancestors: Element[] = [];
  let ancestor = element.parentElement;
  while (ancestor) {
    ancestors.push(ancestor);
    ancestor = ancestor.parentElement;
  }
  return ancestors;
}

function parseRelativeSelector(raw: string): RelativeSelector | null {
  let text = raw.trim();
  if (!text) return null;

  let combinator: Combinator = " ";
  const first = text.charAt(0);
  if (first === ">" || first === "+" || first === "~") {
    combinator = first;
    text = text.slice(1).trim();
  }

  const parts = parseComplexSelector(text);
  return parts.length > 0 ? { combinator, parts } : null;
}

/**
 * Split a complex selector such as `a [data-testid="x"]` into compounds and
 * the combinator that joins each compound to the previous one. Bracketed
 * attribute selectors, functional pseudo-classes and quoted strings are kept
 * intact.
 */
function parseComplexSelector(text: string): ComplexPart[] {
  const parts: ComplexPart[] = [];
  let index = 0;
  let combinator: Combinator = " ";

  while (index < text.length) {
    while (index < text.length && isWhitespace(text.charAt(index))) index += 1;
    if (index >= text.length) break;

    const ch = text.charAt(index);
    if (ch === ">" || ch === "+" || ch === "~") {
      combinator = ch;
      index += 1;
      while (index < text.length && isWhitespace(text.charAt(index))) index += 1;
    } else if (parts.length > 0) {
      combinator = " ";
    }

    const start = index;
    let depth = 0;
    let brackets = 0;
    while (index < text.length) {
      const current = text.charAt(index);
      if (current === '"' || current === "'") {
        index = skipString(text, index, current);
        continue;
      }
      if (current === "(") {
        depth += 1;
        index += 1;
        continue;
      }
      if (current === ")") {
        depth = Math.max(0, depth - 1);
        index += 1;
        continue;
      }
      if (current === "[") {
        brackets += 1;
        index += 1;
        continue;
      }
      if (current === "]") {
        brackets = Math.max(0, brackets - 1);
        index += 1;
        continue;
      }
      if (
        depth === 0 &&
        brackets === 0 &&
        (current === ">" || current === "+" || current === "~" || isWhitespace(current))
      ) {
        break;
      }
      index += 1;
    }

    const selector = text.slice(start, index).trim();
    if (!selector) break;
    parts.push({ combinator, selector });
  }

  return parts;
}

function splitTopLevel(text: string, delimiter: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let brackets = 0;
  let index = 0;

  while (index < text.length) {
    const ch = text.charAt(index);
    if (ch === '"' || ch === "'") {
      index = skipString(text, index, ch);
      continue;
    }
    if (ch === "(") {
      depth += 1;
      index += 1;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      index += 1;
      continue;
    }
    if (ch === "[") {
      brackets += 1;
      index += 1;
      continue;
    }
    if (ch === "]") {
      brackets = Math.max(0, brackets - 1);
      index += 1;
      continue;
    }
    if (ch === delimiter && depth === 0 && brackets === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
    index += 1;
  }

  parts.push(text.slice(start));
  return parts;
}

function findClosingParen(text: string, start: number): number {
  let depth = 1;
  let index = start;

  while (index < text.length) {
    const ch = text.charAt(index);
    if (ch === '"' || ch === "'") {
      index = skipString(text, index, ch);
      continue;
    }
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }

  return -1;
}

function skipString(text: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < text.length) {
    const ch = text.charAt(index);
    if (ch === "\\") {
      index += 2;
      continue;
    }
    if (ch === quote) return index + 1;
    index += 1;
  }
  return text.length;
}

function matchesSelector(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function isWhitespace(value: string): boolean {
  return value === " " || value === "\t" || value === "\n" || value === "\r" || value === "\f";
}
