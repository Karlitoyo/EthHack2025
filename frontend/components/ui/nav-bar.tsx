import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const navBarVariants = cva('navbar bg-base-100 rounded-box shadow-md',
  {
    variants: {
    },
    defaultVariants: {
    },
  },
);

export interface NavBarProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof navBarVariants> {
  asChild?: boolean;
}

const NavBar = React.forwardRef<HTMLDivElement, NavBarProps>(
  (
    {
      className,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(
          navBarVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
NavBar.displayName = 'NavBar';

export { NavBar, navBarVariants };
