export interface MetricInterface<EntryType> {
  addEntry(entry: EntryType): void;
  getValue(): number | undefined;
  reset(): void;
}
