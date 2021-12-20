describe("LUX beacon mode", () => {
  test("does not insert a <script> tag", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(3);
    await page.evaluate("LUX.send()");
    expect(await page.evaluate("[...document.querySelectorAll('script')].length")).toEqual(3);
  });
});
