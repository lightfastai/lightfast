// biome-ignore lint/style/noNamespace: required for satori React HTMLAttributes augmentation
declare namespace React {
  interface HTMLAttributes<_T> {
    tw?: string;
  }
}
