import { beforeEach, describe, expect, it } from "vitest";
import {
  asTypedLocalStorageAdapterMock,
  localStorageAdapterMock,
  localStorageAdapterModuleMock,
} from "@/src/test/localStorageAdapterMock";

describe("localStorageAdapterMock", () => {
  beforeEach(() => {
    localStorageAdapterMock.resetAll();
  });

  it("applies unkeyed reset values to adapters created after the reset", () => {
    // Arrange
    const storageMock = asTypedLocalStorageAdapterMock<string[]>();
    storageMock.reset(["case-1"]);

    // Act
    const adapter = localStorageAdapterModuleMock.createLocalStorageAdapter(
      "cmsnext-recent-cases",
      []
    );

    // Assert
    expect(adapter.read()).toEqual(["case-1"]);
  });
});