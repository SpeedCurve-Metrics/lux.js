import { extractCondensedValue } from "../helpers/lux";

const testPages = [
  ["default configuration", "default.html"],
  ["default configuration with early longtasks", "default-with-snippet-longtasks.html"],
];

describe.each(testPages)("%s", (_, testPage) => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
  let beacon;

  beforeAll(async () => {
    luxRequests.reset();
    await navigateTo(`http://localhost:3000/${testPage}`);
    beacon = luxRequests.getUrl(0);
  });

  test("LUX beacon is automatically sent", () => {
    expect(luxRequests.count()).toEqual(1);
  });

  test("LUX version is included in the beacon", () => {
    expect(parseInt(beacon.searchParams.get("v"), 10)).toBeGreaterThan(200);
  });

  test("customer ID is detected correctly", () => {
    expect(beacon.searchParams.get("id")).toEqual("10001");
  });

  test("page ID and session ID are sent", () => {
    expect(beacon.searchParams.get("sid").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("uid").length).toBeGreaterThan(0);
  });

  test("document title is used as the default page label", () => {
    expect(beacon.searchParams.get("l")).toEqual("LUX Auto Test");
  });

  test("basic page metrics are sent", () => {
    expect(beacon.searchParams.get("NT").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("PS").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("HN").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("CPU").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("CLS").length).toBeGreaterThan(0);

    const navTiming = beacon.searchParams.get("NT");

    expect(extractCondensedValue(navTiming, "fc")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "lc")).toBeGreaterThan(0);
  });
});
