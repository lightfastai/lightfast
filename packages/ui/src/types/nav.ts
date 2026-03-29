import type { Icons } from "../components/icons";

export interface NavItem<H extends string = string> {
  disabled?: boolean;
  external?: boolean;
  href: H;
  icon?: keyof typeof Icons;
  label?: string;
  microfrontend?: boolean;
  title: string;
}
