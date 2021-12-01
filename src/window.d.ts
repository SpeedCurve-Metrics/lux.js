import { LuxGlobal } from "./global"

declare global {
    interface Window {
        LUX?: LuxGlobal;
        LUX_ae?: Error[];
        LUX_al?: PerformanceEntryList;
    }

    interface PerformanceLongTaskTiming extends PerformanceEntry {};

    declare var PerformanceLongTaskTiming: {
        prototype: PerformanceLongTaskTiming;
        new(): PerformanceLongTaskTiming;
    };

    interface LargestContentfulPaint extends PerformanceEntry {};

    declare var LargestContentfulPaint: {
        prototype: LargestContentfulPaint;
        new(): LargestContentfulPaint;
    };

    interface PerformanceElementTiming extends PerformanceEntry {};

    declare var PerformanceElementTiming: {
        prototype: PerformanceElementTiming;
        new(): PerformanceElementTiming;
    };

    interface LayoutShift extends PerformanceEntry {};

    declare var LayoutShift: {
        prototype: LayoutShift;
        new(): LayoutShift;
    };

}
