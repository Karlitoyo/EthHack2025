import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const validatorHintVariants = cva('validator-hint',
  {
    variants: {
    },
    defaultVariants: {
    },
  },
);

export interface ValidatorHintProps
  extends React.ComponentPropsWithoutRef<'p'>,
    VariantProps<typeof validatorHintVariants> {
  asChild?: boolean;
}

const ValidatorHint = React.forwardRef<HTMLParagraphElement, ValidatorHintProps>(
  (
    {
      className,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'p';
    return (
      <Comp
        className={cn(
          validatorHintVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
ValidatorHint.displayName = 'ValidatorHint';

export { ValidatorHint, validatorHintVariants};
