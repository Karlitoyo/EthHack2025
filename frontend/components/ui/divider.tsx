import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const dividerVariants = cva('divider py-1 my-0.5',
  {
    variants: {
      direction: {
        none: '',
        vertical: 'divider-vertical',
        horizontal: 'divider-horizontal',
      },
      placement: {
        none: '',
        start: 'divider-start',
        end: 'divider-end'
      }
    },
    defaultVariants: {
      direction: 'none', 
      placement: 'none',
    },
  },
);

export interface dividerProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof dividerVariants> {
  asChild?: boolean;
}

const Divider = React.forwardRef<HTMLDivElement, dividerProps>(
  (
    {
      className,
      direction,
      placement,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(
          dividerVariants({
            direction,
            placement,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Divider.displayName = 'Divider';

export { Divider, dividerVariants };
