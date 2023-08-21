import { MetricInterface } from ".";

let latestValue: number | undefined;

const LCP: MetricInterface<LargestContentfulPaint> = {
  getValue() {
    return latestValue;
  },

  addEntry(entry) {
    latestValue = entry.startTime;
  },

  reset() {
    latestValue = undefined;
  },
};

export default LCP;
