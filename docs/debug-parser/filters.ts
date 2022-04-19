export function getFilters(filterInputs: NodeListOf<HTMLInputElement>): string[] {
  const filters: string[] = [];

  filterInputs.forEach((filterEl) => {
    const event = filterEl.getAttribute("data-event");

    if (filterEl.checked && event) {
      filters.push(event);
    }
  });

  return filters;
}
