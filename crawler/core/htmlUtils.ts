export function getAttrValue(
  attrs: string,
  attrName: string,
): string | undefined {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
  return attrs.match(pattern)?.[1];
}

export function extractContainerById(
  html: string,
  id: string,
  patterns: RegExp[],
): string[] {
  const containers: string[] = [];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const attrs = match[1] ?? "";
      if (!attrs.includes("id")) continue;
      const elementId = getAttrValue(attrs, "id");
      if (elementId === id) containers.push(match[2] ?? "");
    }
  }
  return containers;
}
