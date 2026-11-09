import { beforeAll } from 'vitest';

// Configure test environment defaults
beforeAll(() => {
  // Ensure system timezone is Asia/Ho_Chi_Minh for test determinism
  process.env.TZ = 'Asia/Ho_Chi_Minh';
  (process.env as any).NODE_ENV = 'test';
});
