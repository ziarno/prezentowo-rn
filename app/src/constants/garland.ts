// Garland design tokens — ported from prezentowo design bundle
// (direction-garland.jsx). Keep in sync with the `garland` palette in
// tailwind.config.js.
export const garland = {
  paper: '#fffaf2',
  paper2: '#f5ede0',
  ink: '#1d1a14',
  ink60: 'rgba(29,26,20,0.6)',
  ink40: 'rgba(29,26,20,0.4)',
  ink15: 'rgba(29,26,20,0.15)',
  ink08: 'rgba(29,26,20,0.08)',
  green: '#2f5b3a',
  amber: '#c7973d',
  berry: '#9a3a25',
}

// Display serif — loaded via expo-font in app/_layout.tsx. If the font fails
// to load, RN will fall back to the platform default sans, which is graceful.
export const displayFont = 'FoglihtenNo07'
