import type { UIComponent, UIRoot } from './_base';

export declare const Select: UIRoot<{
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}>;
export declare const SelectGroup: UIComponent;
export declare const SelectValue: UIComponent;
export declare const SelectTrigger: UIComponent;
export declare const SelectContent: UIComponent;
export declare const SelectLabel: UIComponent;
export declare const SelectItem: UIComponent;
export declare const SelectSeparator: UIComponent;
export declare const SelectScrollUpButton: UIComponent;
export declare const SelectScrollDownButton: UIComponent;
