describe("LUX beacon mode", () => {
  test("does not insert a <script> tag", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");

    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(2);
    await page.evaluate("LUX.send()");
    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(2);
  });
});
