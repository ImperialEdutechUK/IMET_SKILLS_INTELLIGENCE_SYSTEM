import type { KeyboardEvent } from "react";

// ARIA tabs keyboard pattern: Left/Up and Right/Down move between tabs (wrapping),
// Home/End jump to the ends, and focus follows selection. Attach to the element
// that carries role="tablist"; its role="tab" children are found in DOM order.
export function tabKeyDown<T extends string>(
  e: KeyboardEvent<HTMLElement>,
  keys: readonly T[],
  current: T,
  set: (k: T) => void,
): void {
  const idx = keys.indexOf(current);
  let next = idx;
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown": next = (idx + 1) % keys.length; break;
    case "ArrowLeft":
    case "ArrowUp": next = (idx - 1 + keys.length) % keys.length; break;
    case "Home": next = 0; break;
    case "End": next = keys.length - 1; break;
    default: return;
  }
  e.preventDefault();
  const nextKey = keys[next];
  if (nextKey !== undefined) set(nextKey);
  const tabs = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs[next]?.focus();
}
