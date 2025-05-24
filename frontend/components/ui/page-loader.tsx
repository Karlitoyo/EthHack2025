import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const pageLoaderVariants = cva('loading',
  {
    variants: {
      variant: {
        default: 'loading-spinner',
        dots: 'loading-dots',
        bars: 'loading-bars',
        ring: 'loading-ring',
  
      },
      size: {
        default: 'loading-md',
        xs: 'loading-xs',
        sm: 'loading-sm',
        lg: 'loading-lg',
      },

    },
    defaultVariants: {
      variant: 'dots',
      size: 'default',
    },
  },
);

export interface PagerLoaderProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pageLoaderVariants> {
  asChild?: boolean;
}

const PageLoader = React.forwardRef<HTMLSpanElement, PagerLoaderProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'span';
    return (
      <Comp
        className={cn(
          pageLoaderVariants({
            variant,
            size,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
PageLoader.displayName = 'PageLoader';

export { PageLoader, pageLoaderVariants};
