import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount whatever the previous test rendered so component state, timers,
// and Apollo subscriptions from one test never bleed into the next.
afterEach(() => {
  cleanup();
});
