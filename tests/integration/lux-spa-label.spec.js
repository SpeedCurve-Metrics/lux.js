test("page label can be changed between SPA page loads", async () => {
  let luxRequests;
  let beacon;

  await navigateTo("http://localhost:3000/auto-false.html");
  await page.evaluate("LUX.send()");

  luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
  beacon = new URL(luxRequests[0].url());
  expect(beacon.searchParams.get("l")).toBe("LUX SPA Test");

  await page.evaluate("LUX.label = 'Custom Label'");
  await page.evaluate("LUX.init()");
  await page.evaluate("LUX.send()");

  luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
  beacon = new URL(luxRequests[1].url());
  expect(beacon.searchParams.get("l")).toBe("Custom Label");
});

test("default page label changes when document.title changes", async () => {
  let luxRequests;
  let beacon;

  await navigateTo("http://localhost:3000/auto-false.html");
  await page.evaluate("LUX.send()");

  luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
  beacon = new URL(luxRequests[0].url());
  expect(beacon.searchParams.get("l")).toBe("LUX SPA Test");

  await page.evaluate("LUX.init()");
  await page.evaluate("document.title = 'New Document Title'");
  await page.evaluate("LUX.send()");

  luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
  beacon = new URL(luxRequests[1].url());
  expect(beacon.searchParams.get("l")).toBe("New Document Title");
});