export function toBeBetween(received: number, lower: number, upper: number) {
  const pass = received >= lower && received <= upper;
  if (pass) {
    return {
      message: () => "passed",
      pass: true,
    };
  } else {
    return {
      message: () => `expected ${received} to be between ${lower} and ${upper}`,
      pass: false,
    };
  }
}
