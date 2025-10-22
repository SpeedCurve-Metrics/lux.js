import { getNodeSelector } from "../../src/dom";
import "../../src/lux";
import { RageClickEvent, reset } from "../../src/metric/rage-click";

const events: RageClickEvent[] = [];
const dataTable = document.getElementById("rage-click-data") as HTMLTableElement;
const radiusEl = document.getElementById("radius") as HTMLDivElement;

window.LUX?.on("rage_click", (data: RageClickEvent) => {
  const lastEvent = events[events.length - 1];
  const lastEventWasCanceled = data.canceledReason === null && lastEvent?.canceledReason !== null;

  if (lastEventWasCanceled || events.length === 0) {
    events.push(data);
    radiusEl.style.top = data.y - 50 + "px";
    radiusEl.style.left = data.x - 50 + "px";
  } else {
    events[events.length - 1].clicks = data.clicks;
    events[events.length - 1].rage = data.rage;
    events[events.length - 1].canceledReason = data.canceledReason;
  }

  if (data.canceledReason !== null) {
    radiusEl.style.top = "-1000px";
  }

  updateRageData(events);
});

function updateRageData(events: RageClickEvent[]) {
  const rows = [...events]
    .reverse()
    .map(
      (event) => `
        <tr class="${event.rage ? "rage" : ""}">
          <td>${event.clicks}</td>
          <td>${event.rage}</td>
          <td>${event.canceledReason || ""}</td>
          <td>${event.target ? getNodeSelector(event.target) : ""}</td>
        </tr>
      `,
    )
    .join("");

  dataTable.querySelector("tbody")!.innerHTML = rows;
}

const doubleRaF = (cb: () => void) => requestAnimationFrame(() => requestAnimationFrame(cb));
const app = document.querySelector(".app")!;

const initialState = {
  cart: 0,
};

type State = typeof initialState;

const state = new Proxy(initialState, {
  set(target, property, value) {
    const oldValue = target[property as keyof State];

    if (oldValue !== value) {
      target[property as keyof State] = value;
      render(target);
    }

    return true;
  },
});

function render(state: State) {
  document.querySelector(".cart")!.textContent = state.cart
    ? `You have ${state.cart} items in your cart.`
    : "Your cart is empty.";
}

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  if (target.classList.contains("add-to-cart") && !app.classList.contains("loading")) {
    app.classList.add("loading");

    setTimeout(() => {
      doubleRaF(() => {
        const startTime = performance.now();
        while (performance.now() < startTime + 800) {
          // Block the main thread
        }

        state.cart += 1;
        app.classList.remove("loading");
      });
    }, 2200);
  }
});

document.getElementById("reset-rage-data")!.addEventListener("click", () => {
  // Reset the rage click data after a short timeout so that the click on this button isn't counted.
  setTimeout(() => {
    reset();
    events.length = 0;
    radiusEl.style.top = "-1000px";
    dataTable.querySelector("tbody")!.innerHTML = "";
  }, 100);
});
