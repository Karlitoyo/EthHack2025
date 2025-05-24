import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const cardDescriptionVariants = cva('text-sm dark:text-gray-400',
  {
    variants: {
    },
    defaultVariants: {

    },
  },
);

export interface CardDescriptionProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof cardDescriptionVariants> {
  asChild?: boolean;
}

const CardDescription = React.forwardRef<HTMLDivElement, CardDescriptionProps>(
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
          cardDescriptionVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
CardDescription.displayName = 'CardDescription';

export { CardDescription, cardDescriptionVariants };
