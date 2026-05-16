import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: [
            'tests/unit/**/*.test.{ts,tsx}',
            'tests/integration/**/*.test.{ts,tsx}',
        ],
        coverage: {
            provider: 'v8',
            include: ['src/core/lib/**/*.ts'],
            exclude: ['src/core/lib/db.ts', 'src/core/lib/auth.ts'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
