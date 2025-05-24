import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const navItemVariants = cva('',
  {
    variants: {
      position: {
        none: '',
        start: 'navbar-start',
        center: 'navbar-center',
        end: 'navbar-end',
      }
    },
    defaultVariants: {
      position: 'none'
    },
  },
);

export interface NavItemProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof navItemVariants> {
  asChild?: boolean;
}

const NavItem = React.forwardRef<HTMLDivElement, NavItemProps>(
  (
    {
      className,
      position,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(
          navItemVariants({
            position,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
NavItem.displayName = 'NavItem';

export { NavItem, navItemVariants };
