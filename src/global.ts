import { UserConfig } from "./config";

export interface LuxGlobal extends UserConfig {
    gaMarks?: PerformanceEntry[];
    gaMeasures?: PerformanceMeasure[];
};
