import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const cardContentVariants = cva('p-6 pt-0',
  {
    variants: {
    },
    defaultVariants: {

    },
  },
);

export interface CardContentProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof cardContentVariants> {
  asChild?: boolean;
}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  (
    {
      className,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(
          cardContentVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
CardContent.displayName = 'CardContent';

export { CardContent, cardContentVariants };
