import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const toggleVariants = cva('toggle',
  {
    variants: {
      toggleSize: {
        default: 'toggle-md',
        xs: 'toggle-xs',
        sm: 'toggle-sm',
      }
    },
    defaultVariants: {
      toggleSize: 'default'
    },
  },
);

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<'input'>,
    VariantProps<typeof toggleVariants> {
  asChild?: boolean;
}

const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      className,
      toggleSize,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'input';
    return (
      <Comp
        className={cn(
          toggleVariants({
            toggleSize,
            className,
          }),
        )}
        ref={ref}
        {...props}
        type='checkbox'
      />
    );
  },
);
Toggle.displayName = 'Toggle';

export { Toggle, toggleVariants };
