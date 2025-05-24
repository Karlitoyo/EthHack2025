import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const labelVariants = cva('',
  {
    variants: {
      type: {
        default: 'floating-label',
        input: 'input',
        select: 'select'
      },
    },
    defaultVariants: {
    },
  },
);

export interface LabelProps
  extends React.ComponentPropsWithoutRef<'label'>,
    VariantProps<typeof labelVariants> {
  asChild?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      className,
      type,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'label';
    return (
      <Comp
        className={cn(
          labelVariants({
            type,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Label.displayName = 'Label';

export { Label, labelVariants};
