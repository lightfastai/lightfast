import type { ComponentType } from "react";
import * as Lucide from "lucide-react-native";

export const ICON_SIZE = 20;
export const ICON_STROKE_WIDTH = 2;

type AnyIcon = ComponentType<any>;

function withDefaults<T extends AnyIcon>(Icon: T) {
  return function IconWithDefaults(props: React.ComponentProps<T>) {
    return (
      // @ts-expect-error lucide icon components share common props
      <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} {...props} />
    );
  };
}

export const AppIcons = {
  // Commonly used icons
  MessageCirclePlus: withDefaults(Lucide.MessageCirclePlus),
  Search: withDefaults(Lucide.Search),
  ChevronLeft: withDefaults(Lucide.ChevronLeft),
  EllipsisVertical: withDefaults(Lucide.EllipsisVertical ?? Lucide.MoreVertical),
};

export type AppIconName = keyof typeof AppIcons;

