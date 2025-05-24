import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const cardHeaderVariants = cva('flex flex-col space-y-1.5 p-6',
  {
    variants: {
    },
    defaultVariants: {

    },
  },
);

export interface CardHeaderProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof cardHeaderVariants> {
  asChild?: boolean;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
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
          cardHeaderVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
CardHeader.displayName = 'CardHeader';

export { CardHeader, cardHeaderVariants };
