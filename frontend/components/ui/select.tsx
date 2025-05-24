import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const selectVariants = cva('select',
  {
    variants: {
      sizeSelect: {
        default: 'select-md',
        sm: 'select-sm',
        lg: 'select-lg'
      },
      joinItem: {
        yes: 'join-item',
        no: '',
      }
    },
    defaultVariants: {
      sizeSelect: 'default',
      joinItem: 'no'
    },

  },
);

export interface SelectProps
  extends React.ComponentPropsWithoutRef<'select'>,
    VariantProps<typeof selectVariants> {
  asChild?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      sizeSelect,
      joinItem,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'select';
    return (
      <Comp
        className={cn(
          selectVariants({
            sizeSelect,
            joinItem,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Select.displayName = 'Select';

export { Select, selectVariants };
