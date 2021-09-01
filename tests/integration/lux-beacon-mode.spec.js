describe("LUX beacon mode", () => {
  test("inserts a <script> tag by default", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(3);
    await page.evaluate("LUX.send()");
    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(4);
  });

  test("does not insert a <script> tag with beaconMode = 'simple'", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.beaconMode = 'simple'");

    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(3);
    await page.evaluate("LUX.send()");
    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(3);
  });

  test("beaconMode can be changed at any time", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(3);
    await page.evaluate("LUX.send()");
    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(4);
    await page.evaluate("LUX.beaconMode = 'simple'");
    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.send()");
    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(4);
  });
});
