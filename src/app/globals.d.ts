declare module '*.css';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: string;
    }
  }
}
