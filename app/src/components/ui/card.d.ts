import * as React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export declare const Card: React.ForwardRefExoticComponent<
  DivProps & React.RefAttributes<HTMLDivElement>
>;
export declare const CardHeader: React.ForwardRefExoticComponent<
  DivProps & React.RefAttributes<HTMLDivElement>
>;
export declare const CardFooter: React.ForwardRefExoticComponent<
  DivProps & React.RefAttributes<HTMLDivElement>
>;
export declare const CardTitle: React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLHeadingElement> &
    React.RefAttributes<HTMLHeadingElement>
>;
export declare const CardDescription: React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLParagraphElement> &
    React.RefAttributes<HTMLParagraphElement>
>;
export declare const CardContent: React.ForwardRefExoticComponent<
  DivProps & React.RefAttributes<HTMLDivElement>
>;
