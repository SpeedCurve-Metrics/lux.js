window.externalLongTask = (function externalLongTaskWrapper() {
  const externalLongTask = (duration = 50) => {
    const startTime = performance.now();

    while (performance.now() < startTime + duration) {
      // Block the main thread for the specified time
    }
  };

  externalLongTask();

  return externalLongTask;
})();
