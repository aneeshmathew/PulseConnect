import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const storageValues = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: {
		get length() {
			return storageValues.size;
		},
		clear() {
			storageValues.clear();
		},
		getItem(key: string) {
			return storageValues.get(key) ?? null;
		},
		key(index: number) {
			return [...storageValues.keys()][index] ?? null;
		},
		removeItem(key: string) {
			storageValues.delete(key);
		},
		setItem(key: string, value: string) {
			storageValues.set(key, String(value));
		},
	} satisfies Storage,
});

// Unmount whatever the previous test rendered so component state, timers,
// and Apollo subscriptions from one test never bleed into the next.
afterEach(() => {
  cleanup();
});
