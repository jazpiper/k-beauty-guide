export const makePreviewArt = (title, subtitle, accent, bg) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bg}" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#g)" />
      <rect x="28" y="28" width="584" height="304" rx="20" fill="#ffffff" fill-opacity="0.86" stroke="${accent}" stroke-width="3" />
      <rect x="56" y="58" width="84" height="32" rx="9" fill="${accent}" fill-opacity="0.16" />
      <text x="78" y="80" fill="${accent}" font-family="Arial, sans-serif" font-size="16" font-weight="700">Preview</text>
      <text x="56" y="148" fill="#1f2937" font-family="Arial, sans-serif" font-size="34" font-weight="700">${title}</text>
      <text x="56" y="190" fill="#4b5563" font-family="Arial, sans-serif" font-size="18">${subtitle}</text>
      <rect x="56" y="230" width="220" height="18" rx="9" fill="${accent}" fill-opacity="0.25" />
      <rect x="56" y="260" width="360" height="12" rx="6" fill="#cbd5e1" />
      <rect x="56" y="282" width="280" height="12" rx="6" fill="#dbe3ee" />
    </svg>
  `)}`;
