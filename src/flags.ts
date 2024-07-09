const Flags = {
  InitCalled: 1 << 0,
  NavTimingNotSupported: 1 << 1,
  UserTimingNotSupported: 1 << 2,
  VisibilityStateNotVisible: 1 << 3,
  BeaconSentFromUnloadHandler: 1 << 4,
  BeaconSentAfterTimeout: 1 << 5,
  PageLabelFromDocumentTitle: 1 << 6,
  PageLabelFromLabelProp: 1 << 7,
  PageLabelFromGlobalVariable: 1 << 8,
  PageLabelFromUrlPattern: 1 << 9,
  PageWasPrerendered: 1 << 10,
  PageWasBfCacheRestored: 1 << 11,
  BeaconBlockedByCsp: 1 << 12,
};

export function addFlag(flags: number, flag: number): number {
  return flags | flag;
}

export function removeFlag(flags: number, flag: number): number {
  return flags & ~flag;
}

export function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) === flag;
}

export default Flags;
