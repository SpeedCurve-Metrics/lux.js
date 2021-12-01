export default function now() {
  return Date.now ? Date.now() : +new Date();
}
