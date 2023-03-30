let sessionValue = 0;
let sessionEntries: LayoutShift[] = [];

export function addEntry(entry: LayoutShift): void {
  if (!entry.hadRecentInput) {
    const firstEntry = sessionEntries[0];
    const latestEntry = sessionEntries[sessionEntries.length - 1];

    if (
      sessionEntries.length &&
      (entry.startTime - latestEntry.startTime >= 1000 ||
        entry.startTime - firstEntry.startTime >= 5000)
    ) {
      reset();
    }

    sessionValue += entry.value;
    sessionEntries.push(entry);
  }
}

export function reset(): void {
  sessionValue = 0;
  sessionEntries = [];
}

export function getCLS(): number {
  return sessionValue;
}
