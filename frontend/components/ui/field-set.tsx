import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const fieldsetVariants = cva('fieldset',
  {
    variants: {
    },
    defaultVariants: {
    },
  },
);

export interface FieldSetProps
  extends React.ComponentPropsWithoutRef<'fieldset'>,
    VariantProps<typeof fieldsetVariants> {
  asChild?: boolean;
}

const FieldSet = React.forwardRef<HTMLFieldSetElement, FieldSetProps>(
  (
    {
      className,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'fieldset';
    return (
      <Comp
        className={cn(
          fieldsetVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
FieldSet.displayName = 'FieldSet';

export { FieldSet, fieldsetVariants };
