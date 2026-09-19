import { describe, expect, it } from "vitest";
import { formatQuantity, pluralizeUnit } from "@/lib/units";

describe("unit formatting", () => {
  it("formats common countable units", () => {
    expect(formatQuantity(1, "box")).toBe("1 box");
    expect(formatQuantity(2, "box")).toBe("2 boxes");
    expect(formatQuantity(3, "piece")).toBe("3 pieces");
    expect(formatQuantity(4, "kilo")).toBe("4 kilos");
  });

  it("does not pluralize measurement symbols", () => {
    expect(pluralizeUnit(5, "kg")).toBe("kg");
    expect(pluralizeUnit(8, "ml")).toBe("ml");
  });
});
