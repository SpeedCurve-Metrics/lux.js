window.calculatePrimes = function calculatePrimes(start, max) {
  const sieve = [];

  for (let i = Math.max(start, 2); i <= max; ++i) {
    if (!sieve[i]) {
      for (let j = i << 1; j <= max; j += i) {
        sieve[j] = true;
      }
    }
  }
};
