import { memo } from "react";
import { HexColorPicker } from "react-colorful";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";

interface ColorPickerFieldProps {
  field: any;
  onValueChange: (value: string) => void;
}

export const ColorPickerField = memo(
  ({ field, onValueChange }: ColorPickerFieldProps) => {
    return (
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              aria-label="Pick a color"
              style={{
                backgroundColor: field.value,
              }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" sideOffset={5}>
            <HexColorPicker
              className="m-auto w-full border-none p-0"
              color={field.value}
              onChange={(color) => {
                field.onChange(color);
                onValueChange(color);
              }}
            />
          </PopoverContent>
        </Popover>
        <Input
          {...field}
          className="font-mono text-xs tracking-widest uppercase"
          onChange={(e) => {
            field.onChange(e.target.value);
            onValueChange(e.target.value);
          }}
          value={field.value as string}
        />
      </div>
    );
  },
);

ColorPickerField.displayName = "ColorPickerField";
