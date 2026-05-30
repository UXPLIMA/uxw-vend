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
            // Only db.ts (a Prisma client singleton, no logic) and auth.ts (the
            // NextAuth config — can't be imported outside the Next bundler, see
            // tests/integration/two-factor-flow.test.ts) are excluded.
            //
            // The two most security-critical files — permissions.ts (the admin
            // authorization gate) and secret-storage.ts (at-rest secret crypto)
            // — are deliberately NOT excluded so their coverage is measured and
            // can be enforced. Do not add them here.
            exclude: ['src/core/lib/db.ts', 'src/core/lib/auth.ts'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
