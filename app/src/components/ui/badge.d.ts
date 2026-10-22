import * as React from 'react';

export declare const Badge: React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> &
    React.RefAttributes<HTMLDivElement> & {
      variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    }
>;

export declare function badgeVariants(props?: {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | null;
  className?: string;
}): string;
