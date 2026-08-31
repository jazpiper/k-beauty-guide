import { makePreviewArt } from "./previewArt";

describe("makePreviewArt", () => {
  it("generates a valid data URL containing encoded SVG elements and parameters", () => {
    const title = "Test Title";
    const subtitle = "Test Subtitle";
    const accent = "#123456";
    const bg = "#abcdef";

    const result = makePreviewArt(title, subtitle, accent, bg);

    expect(result).toMatch(/^data:image\/svg\+xml;charset=UTF-8,/);

    const decoded = decodeURIComponent(
      result.replace("data:image/svg+xml;charset=UTF-8,", ""),
    );

    expect(decoded).toContain(`aria-label="${title}"`);
    expect(decoded).toContain(`<stop offset="0%" stop-color="${bg}" />`);
    expect(decoded).toContain(`stroke="${accent}"`);
    expect(decoded).toContain(`>${title}</text>`);
    expect(decoded).toContain(`>${subtitle}</text>`);
  });
});
