import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const inputVariants = cva('w-auto',
  {
    variants: {
      variant: {
        default: '',
        primary: 'input-primary',
        error: 'input-error',
      },
      inputType: {
        none: '',
        default: 'input',
        button: 'btn'
      },
      inputSize: {
        default: 'input-md',
        sm: 'input-sm',
        lg: 'input-lg'
      },
      joinItem: {
        yes: 'join-item',
        no: '',
      }
    },
    defaultVariants: {
      variant: 'default',
      inputType: 'default',
      inputSize: 'default',
      joinItem: 'no'
    },
  },
);

export interface InputProps
  extends React.ComponentPropsWithoutRef<'input'>,
    VariantProps<typeof inputVariants> {
  asChild?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      inputType,
      inputSize,
      joinItem,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'input';
    return (
      <Comp
        className={cn(
          inputVariants({
            variant,
            inputType,
            inputSize,
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
Input.displayName = 'Input';

export { Input, inputVariants};
