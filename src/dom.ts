export function hasParentNode(el: HTMLElement): boolean {
  if (el.parentNode && (el.parentNode as HTMLElement).tagName) {
    return true;
  }

  return false;
}
