type ElementWithParentNode = Element & {
  parentNode: Element;
};

export function hasParentNode(el: Element): el is ElementWithParentNode {
  if (el.parentNode && (el.parentNode as Element).tagName) {
    return true;
  }

  return false;
}
