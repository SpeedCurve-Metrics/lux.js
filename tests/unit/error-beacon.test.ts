import { describe, expect, test, jest, beforeEach } from "@jest/globals";

describe("error-beacon", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function makeConfig() {
    return {
      errorBeaconUrl: "https://beacon.example.com/store/error",
      errorBeaconDelay: 0,
    };
  }

  function fullContext() {
    return {
      customerId: "100001000",
      pageId: "pg",
      sessionId: "sid",
      scriptVersion: "4.x",
      hostname: "example.com",
      pathname: "/",
      pageLabel: "Home",
      connectionType: "4G",
      deliveryType: "cache",
      navigationType: 0,
      deviceMemory: 8,
      flags: 3,
      customData: { region: "eu", tier: "pro" },
    };
  }

  async function captureFlushedPayload(context: object): Promise<Record<string, unknown>> {
    const captured: { body?: string } = {};
    jest.doMock("../../src/transport", () => ({
      postJson: (_url: string, body: string) => {
        captured.body = body;
        return true;
      },
    }));

    const { queueErrorBeacon } = await import("../../src/error-beacon");

    const error = {
      filename: "a.js",
      lineno: 1,
      colno: 1,
      message: "boom",
    } as unknown as ErrorEvent;

    queueErrorBeacon(makeConfig() as never, error, 10, context as never);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(captured.body).toBeDefined();
    return JSON.parse(captured.body!);
  }

  test("flushed beacon includes all filter fields when present", async () => {
    const payload = await captureFlushedPayload(fullContext());
    expect(payload.connectionType).toBe("4G");
    expect(payload.deliveryType).toBe("cache");
    expect(payload.navigationType).toBe(0);
    expect(payload.deviceMemory).toBe(8);
    expect(payload.flags).toBe(3);
    expect(payload.customData).toEqual({ region: "eu", tier: "pro" });
    expect(payload.errors).toHaveLength(1);
  });

  test("undefined filter fields are omitted from the JSON payload", async () => {
    const ctx = {
      ...fullContext(),
      connectionType: undefined,
      deliveryType: undefined,
      deviceMemory: undefined,
    };
    const payload = await captureFlushedPayload(ctx);
    expect("connectionType" in payload).toBe(false);
    expect("deliveryType" in payload).toBe(false);
    expect("deviceMemory" in payload).toBe(false);
    expect(payload.flags).toBe(3);
    expect(payload.navigationType).toBe(0);
  });

  test("empty customData is sent as an empty object", async () => {
    const payload = await captureFlushedPayload({
      ...fullContext(),
      customData: {},
    });
    expect(payload.customData).toEqual({});
  });

  test("buffer is flushed when it reaches the max errors per beacon", async () => {
    const bodies: string[] = [];
    jest.doMock("../../src/transport", () => ({
      postJson: (_url: string, body: string) => {
        bodies.push(body);
        return true;
      },
    }));

    const { queueErrorBeacon } = await import("../../src/error-beacon");

    const config = makeConfig();
    const context = fullContext();
    const makeError = (i: number) =>
      ({
        filename: "a.js",
        lineno: i,
        colno: 1,
        message: `boom ${i}`,
      }) as unknown as ErrorEvent;

    for (let i = 0; i < 65; i++) {
      queueErrorBeacon(config as never, makeError(i), i, context as never);
    }

    expect(bodies).toHaveLength(1);
    expect((JSON.parse(bodies[0]) as { errors: unknown[] }).errors).toHaveLength(64);

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(bodies).toHaveLength(2);
    expect((JSON.parse(bodies[1]) as { errors: unknown[] }).errors).toHaveLength(1);
  });
});
