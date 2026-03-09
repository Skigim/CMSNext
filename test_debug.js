const { describe, it, vi } = require("vitest");

describe("fake timer debug", () => {
  it("shows the issue", () => {
    const fixedNow = new Date("2025-02-15T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    
    function getFirstOfMonth(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}-01`;
    }
    
    console.log("Fixed now:", fixedNow);
    console.log("new Date():", new Date());
    console.log("getFirstOfMonth():", getFirstOfMonth());
    console.log("getFirstOfMonth result:", getFirstOfMonth());
    
    vi.useRealTimers();
  });
});
