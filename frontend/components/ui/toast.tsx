import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const toastVariants = cva('toast',
  {
    variants: {
      align: {
        start: 'toast-start',
        center: 'toast-center',
        default: 'toast-end',
        top: 'toast-top',
        middle: 'toast-middle',
        bottom: 'toast-bottom',
      }
    },
    defaultVariants: {
      align: 'default'
    },
  },
);

export interface ToastProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof toastVariants> {
  asChild?: boolean;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      className,
      align,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(
          toastVariants({
            align,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Toast.displayName = 'Toast';

export { Toast, toastVariants };
