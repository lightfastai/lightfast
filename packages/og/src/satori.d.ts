export {};

declare module "react" {
  interface HTMLAttributes<T> {
    tw?: string;
  }
}
