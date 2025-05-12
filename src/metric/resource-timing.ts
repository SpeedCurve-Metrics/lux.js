export enum ResourceType {
  SCRIPT,
  STYLESHEET,
  BLOCKING_SCRIPT,
  BLOCKING_STYLESHEET,
}

let resources: Record<ResourceType, number>;
let supportsRenderBlockingStatus = false;

reset();

export function reset(): void {
  resources = {
    [ResourceType.SCRIPT]: 0,
    [ResourceType.STYLESHEET]: 0,
    [ResourceType.BLOCKING_SCRIPT]: supportsRenderBlockingStatus ? 0 : -1,
    [ResourceType.BLOCKING_STYLESHEET]: supportsRenderBlockingStatus ? 0 : -1,
  };
}

export function processEntry(entry: PerformanceResourceTiming): void {
  if (resources[ResourceType.BLOCKING_SCRIPT] === -1 && "renderBlockingStatus" in entry) {
    // Detect support for renderBlockingStatus
    resources[ResourceType.BLOCKING_SCRIPT] = 0;
    resources[ResourceType.BLOCKING_STYLESHEET] = 0;
    supportsRenderBlockingStatus = true;
  }

  if (entry.initiatorType === "script") {
    resources[ResourceType.SCRIPT]!++;

    if (entry.renderBlockingStatus === "blocking") {
      resources[ResourceType.BLOCKING_SCRIPT]!++;
    }
  } else if (entry.initiatorType === "link") {
    resources[ResourceType.STYLESHEET]!++;

    if (entry.renderBlockingStatus === "blocking") {
      resources[ResourceType.BLOCKING_STYLESHEET]!++;
    }
  }
}

export function getData() {
  return resources;
}
