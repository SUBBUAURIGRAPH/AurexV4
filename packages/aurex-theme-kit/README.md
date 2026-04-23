# @aurigraph/aurex-theme-kit

Reusable theme package extracted from AurexV3 core styling:

- Aurex brand styles (`aurex-theme.css`)
- Admin design tokens (`design-tokens.css`)
- React `ThemeProvider` (`light`/`dark`/`auto`)

## Install / Link

In a monorepo, add this package and import it from your app entrypoint.

## Usage (React)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@aurigraph/aurex-theme-kit';
import '@aurigraph/aurex-theme-kit/src/index';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="auto">
    <App />
  </ThemeProvider>
);
```

## Toggle Theme

```tsx
import { useTheme } from '@aurigraph/aurex-theme-kit';

export function ThemeToggle() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <button onClick={toggleTheme}>Current: {theme}</button>
      <button onClick={() => setTheme('auto')}>System</button>
    </div>
  );
}
```

## Notes

- This package intentionally keeps AurexV3 token names (`--aurex-*`, `--admin-*`) for compatibility.
- If your target app uses Tailwind, import this before app-specific overrides.
