import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const cardVariants = cva('card bg-base-100 shadow-sm rounded-lg',
  {
    variants: {
    },
    defaultVariants: {

    },
  },
);

export interface CardProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
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
          cardVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

export { Card, cardVariants };
