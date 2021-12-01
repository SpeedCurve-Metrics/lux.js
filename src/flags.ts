enum Flags {
  InitCalled = 1,
  NavTimingNotSupported = 2,
  UserTimingNotSupported = 4,
  VisibilityStateNotVisible = 8,
  BeaconSentFromUnloadHandler = 16,
  BeaconSentAfterTimeout = 32,
}

export default Flags;
