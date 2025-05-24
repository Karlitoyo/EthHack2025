import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const alertVariants = cva('alert',
  {
    variants: {
      variant: {
        info: 'alert-info',
        default: 'alert-success',
        warning: 'alert-warning',
        error: 'alert-error'
      },
      direction: {
        none: '',
        vertical: 'alert-vertical',
        horizontal: 'alert-horizontal'
      },
      alertStyle: {
        default: '',
        dash: 'alert-dash',
        soft: 'alert-soft',
        outline: 'alert-outline'
      }
    },
    defaultVariants: {
      variant: 'default',
      direction: 'none',
      alertStyle: 'default'
    },
  },
);

export interface AlertProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof alertVariants> {
  asChild?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant,
      direction,
      alertStyle,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(
          alertVariants({
            variant,
            direction,
            alertStyle,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };
