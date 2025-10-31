import * as PROPS from "./minification";

type Callback = (data?: EventData) => void;
type EventData = unknown;

export type Event = "beacon" | "new_page_id" | "rage_click";

const subscribers: Partial<Record<Event, Callback[]>> = {};
const eventData: Partial<Record<Event, EventData>> = {};

export function subscribe(event: Event, callback: Callback): void {
  if (!subscribers[event]) {
    subscribers[event] = [];
  }

  subscribers[event][PROPS._push](callback);

  // Ensure previous event data is available to new subscribers
  if (eventData[event] !== undefined) {
    callback(eventData[event]);
  }
}

export function emit(event: Event, data?: EventData): void {
  eventData[event] = data;

  if (!subscribers[event]) {
    return;
  }

  subscribers[event].forEach((callback) => callback(data));
}
