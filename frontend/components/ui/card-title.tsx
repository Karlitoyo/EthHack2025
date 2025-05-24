import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const cardTitleVariants = cva('text-2xl font-semibold leading-none tracking-tight',
  {
    variants: {
    },
    defaultVariants: {

    },
  },
);

export interface CardTitleProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof cardTitleVariants> {
  asChild?: boolean;
}

const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
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
          cardTitleVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
CardTitle.displayName = 'CardTitle';

export { CardTitle, cardTitleVariants  };
