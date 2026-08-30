const sendBeaconFallback = (url: string, data: string) => {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("content-type", "application/json");
  xhr.send(data);

  return true;
};

const sendBeaconImpl =
  "sendBeacon" in navigator ? navigator.sendBeacon.bind(navigator) : sendBeaconFallback;

export function postJson(url: string, data: string): boolean {
  return sendBeaconImpl(url, data);
}
