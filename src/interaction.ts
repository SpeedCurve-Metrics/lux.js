import { hasParentNode } from "./dom";

export interface InteractionInfo {
  c?: number; // Click time
  ci?: string; // Click attribution identifier
  cx?: number; // Click X position
  cy?: number; // Click Y position
  k?: number; // Key press time
  ki?: string; // Key press attribution identifier
  s?: number; // Scroll time
}

type ButtonOrLinkElement = HTMLButtonElement | HTMLLinkElement;

/**
 * Get the interaction attribution name for an element
 */
export function interactionAttributionForElement(el: Element): string {
  // Our first preference is to use the data-sctrack attribute from anywhere in the tree
  const trackId = getClosestScTrackAttribute(el);

  if (trackId) {
    return trackId;
  }

  // The second preference is to use the element's ID
  if (el.id) {
    return el.id;
  }

  // The third preference is to use the text content of a button or link
  const isSubmitInput = el.tagName === "INPUT" && (el as HTMLInputElement).type === "submit";
  const isButton = el.tagName === "BUTTON";
  const isLink = el.tagName === "A";

  if (isSubmitInput && (el as HTMLInputElement).value) {
    return (el as HTMLInputElement).value;
  }

  if ((isButton || isLink) && (el as ButtonOrLinkElement).innerText) {
    return (el as ButtonOrLinkElement).innerText;
  }

  if (hasParentNode(el)) {
    return interactionAttributionForElement(el.parentNode);
  }

  // No suitable attribute was found
  return "";
}

function getClosestScTrackAttribute(el: Element): string | null {
  if (el.hasAttribute("data-sctrack")) {
    const trackId = el.getAttribute("data-sctrack")?.trim();

    if (trackId) {
      return trackId;
    }
  }

  if (hasParentNode(el)) {
    return getClosestScTrackAttribute(el.parentNode);
  }

  return null;
}
