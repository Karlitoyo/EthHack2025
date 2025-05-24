import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const cardFooterVariants = cva('flex p-6 pt-0',
  {
    variants: {
      position: {
        start: 'justify-start',
        center: 'items-center',
        end: 'justify-end'
      }
    },
    defaultVariants: {
      position: 'end'
    },
  },
);

export interface CardFooterProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof cardFooterVariants> {
  asChild?: boolean;
}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  (
    {
      className,
      position,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(
          cardFooterVariants({
            position,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
CardFooter.displayName = 'CardFooter';

export { CardFooter, cardFooterVariants};
