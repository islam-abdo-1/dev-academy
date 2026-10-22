import * as React from 'react';

export type UIProps<P = Record<string, any>> = P &
  React.PropsWithChildren<Record<string, any>>;

export type UIComponent<P = Record<string, any>> = React.ForwardRefExoticComponent<
  UIProps<P> & React.RefAttributes<any>
>;

export type UIRoot<P = Record<string, any>> = React.ComponentType<UIProps<P>>;
