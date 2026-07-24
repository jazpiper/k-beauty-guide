export function getAttrValue(
  attrs: string,
  attrName: string,
): string | undefined {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = attrs.match(pattern);
  return match?.[1];
}
