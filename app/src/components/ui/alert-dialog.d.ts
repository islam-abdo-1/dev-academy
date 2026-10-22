import type { UIComponent, UIRoot } from './_base';

export declare const AlertDialog: UIRoot<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;
export declare const AlertDialogPortal: UIRoot;
export declare const AlertDialogOverlay: UIComponent;
export declare const AlertDialogTrigger: UIComponent;
export declare const AlertDialogContent: UIComponent;
export declare const AlertDialogHeader: UIComponent;
export declare const AlertDialogFooter: UIComponent;
export declare const AlertDialogTitle: UIComponent;
export declare const AlertDialogDescription: UIComponent;
export declare const AlertDialogAction: UIComponent;
export declare const AlertDialogCancel: UIComponent;
