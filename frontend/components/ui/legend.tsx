import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const LengendVariants = cva('fieldset-legend',
  {
    variants: {
    },
    defaultVariants: {
    },
  },
);

export interface LengendProps
  extends React.ComponentPropsWithoutRef<'legend'>,
    VariantProps<typeof LengendVariants> {
  asChild?: boolean;
}

const Lengend = React.forwardRef<HTMLLegendElement, LengendProps>(
  (
    {
      className,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'legend';
    return (
      <Comp
        className={cn(
          LengendVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Lengend.displayName = 'Lengend';

export { Lengend, LengendVariants };
