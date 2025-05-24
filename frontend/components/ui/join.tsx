import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const JoinVariants = cva('join',
  {
    variants: {
      direction: {
        none: '',
        vertical: 'join-vertical',
        horizontal: 'join-horizontal'
      }
    },
    defaultVariants: {
      direction: 'none'
    },
  },
);

export interface JoinProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof JoinVariants> {
  asChild?: boolean;
}

const Join = React.forwardRef<HTMLDivElement, JoinProps>(
  (
    {
      className,
      direction,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(
          JoinVariants({
            direction,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Join.displayName = 'Join';

export {Join, JoinVariants };
