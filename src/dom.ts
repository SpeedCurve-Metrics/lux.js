import * as PROPS from "./minification";

export function getClosestScTrackAttribute(el: Element): string | null {
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

type ElementWithParentNode = Element & {
  parentNode: Element;
};

export function hasParentNode(el: Element): el is ElementWithParentNode {
  if (el.parentNode && (el.parentNode as Element).tagName) {
    return true;
  }

  return false;
}

const MAX_SELECTOR_LENGTH = 100;

export function getNodeSelector(node: Node, selector = ""): string {
  return _getNodeSelector(node, selector).slice(0, MAX_SELECTOR_LENGTH);
}

function _getNodeSelector(node: Node, selector = ""): string {
  try {
    if (
      selector &&
      (node.nodeType === 9 || selector[PROPS.length] > MAX_SELECTOR_LENGTH || !node.parentNode)
    ) {
      // Final selector.
      return selector;
    }

    const el = node as Element;

    // Our first preference is to use the data-sctrack attribute from anywhere in the tree
    const trackId = getClosestScTrackAttribute(el);

    if (trackId) {
      return trackId;
    }

    if (el.id) {
      // Once we've found an element with ID we return the selector.
      return "#" + el.id + (selector ? ">" + selector : "");
    } else if (el) {
      // Otherwise attempt to get parent elements recursively
      const name = el.nodeType === 1 ? el.nodeName.toLowerCase() : el.nodeName.toUpperCase();
      let classes = el.className ? "." + el.className.replace(/\s+/g, ".") : "";

      // Remove classes until the selector is short enough
      while ((name + classes)[PROPS.length] > MAX_SELECTOR_LENGTH) {
        classes = classes.split(".").slice(0, -1).join(".");
      }

      const currentSelector = name + classes + (selector ? ">" + selector : "");

      if (el.parentNode) {
        const selectorWithParent = getNodeSelector(el.parentNode, currentSelector);

        if (selectorWithParent[PROPS.length] < MAX_SELECTOR_LENGTH) {
          return selectorWithParent;
        }
      }

      return currentSelector;
    }
  } catch (error) {
    // Do nothing.
  }

  return selector;
}
