import type { UIComponent, UIRoot } from './_base';

export declare const Dialog: UIRoot<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
}>;
export declare const DialogTrigger: UIComponent;
export declare const DialogPortal: UIRoot;
export declare const DialogOverlay: UIComponent;
export declare const DialogClose: UIComponent;
export declare const DialogContent: UIComponent;
export declare const DialogHeader: UIComponent;
export declare const DialogFooter: UIComponent;
export declare const DialogTitle: UIComponent;
export declare const DialogDescription: UIComponent;
