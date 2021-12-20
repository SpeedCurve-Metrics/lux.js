import { LuxGlobal } from "./global";

declare global {
  // LUX globals
  interface Window {
    LUX?: LuxGlobal;
    LUX_ae?: ErrorEvent[];
    LUX_al?: PerformanceEntryList;

    chrome: {
      loadTimes?: () => ChromeLoadTimes;
    };
  }

  // Internet Explorer 8 compatibility
  interface Window {
    attachEvent(event: string, listener: EventListener): boolean;
    detachEvent(event: string, listener: EventListener): void;
  }

  // Internet Explorer 9 compatibility
  interface PerformanceTiming {
    msFirstPaint: number;
  }

  // Vendor-specific APIs
  interface ChromeLoadTimes {
    firstPaintTime: number;
  }

  interface Performance {
    webkitGetEntriesByType: typeof performance.getEntriesByType;
    webkitMark: typeof performance.mark;
    webkitMeasure: typeof performance.measure;
  }

  /**
   * The following types are from various web specifications. As of December 2021 these types are
   * missing from lib.dom.d.ts, so I have made a best effort to define them based on the specs.
   */
  // Device Memory 1: https://w3c.github.io/device-memory/#sec-device-memory-js-api
  interface Navigator {
    deviceMemory: number;
  }

  // Network Information API: https://wicg.github.io/netinfo/#networkinformation-interface
  enum ConnectionType {
    Bluetooth = "bluetooth",
    Cellular = "cellular",
    Ethernet = "ethernet",
    Mixed = "mixed",
    None = "none",
    Other = "other",
    Unknown = "unknown",
    Wifi = "wifi",
    Wimax = "wimax",
  }

  enum EffectiveConnectionType {
    _2G = "2g",
    _3G = "3g",
    _4G = "4g",
    Slow2G = "slow-2g",
  }

  interface NetworkInformation {
    type: ConnectionType;
    effectiveType: EffectiveConnectionType;
    downlinkMax: number;
    downlink: number;
    rtt: number;
  }

  // Long Tasks API 1: https://w3c.github.io/longtasks/#sec-PerformanceLongTaskTiming
  interface TaskAttributionTiming extends PerformanceEntry {
    containerType: "iframe" | "embed" | "object";
    containerSrc: string;
    containerId: string;
    containerName: string;
  }

  interface PerformanceLongTaskTiming extends PerformanceEntry {
    attribution: TaskAttributionTiming[];
  }

  declare const PerformanceLongTaskTiming: {
    prototype: PerformanceLongTaskTiming;
    new (): PerformanceLongTaskTiming;
  };

  // Largest Contentful Paint: https://wicg.github.io/largest-contentful-paint/#sec-largest-contentful-paint-interface
  interface LargestContentfulPaint extends PerformanceEntry {
    renderTime: DOMHighResTimeStamp;
    loadTime: DOMHighResTimeStamp;
    size: number;
    id: string;
    url: string;
    element: Element;
  }

  declare const LargestContentfulPaint: {
    prototype: LargestContentfulPaint;
    new (): LargestContentfulPaint;
  };

  // Element Timing API: https://wicg.github.io/element-timing/#sec-performance-element-timing
  interface PerformanceElementTiming extends PerformanceEntry {
    element: Element;
    id: string;
    identifier: string;
    intersectionRect: DOMRectReadOnly;
    loadTime: DOMHighResTimeStamp;
    naturalHeight: number;
    naturalWidth: number;
    renderTime: DOMHighResTimeStamp;
    url: string;
  }

  declare const PerformanceElementTiming: {
    prototype: PerformanceElementTiming;
    new (): PerformanceElementTiming;
  };

  interface LayoutShiftAttribution {
    node?: Node;
    previousRect: DOMRectReadOnly;
    currentRect: DOMRectReadOnly;
  }

  // Layout Instability: https://wicg.github.io/layout-instability/#sec-layout-shift
  interface LayoutShift extends PerformanceEntry {
    value: number;
    hadRecentInput: boolean;
    lastInputTime: DOMHighResTimeStamp;
    sources: LayoutShiftAttribution[];
  }

  declare const LayoutShift: {
    prototype: LayoutShift;
    new (): LayoutShift;
  };
}