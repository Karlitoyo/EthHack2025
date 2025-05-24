import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const spanVariants = cva('',
  {
    variants: {
      type: {
        none: '',
        label: 'label'
      },
    },
    defaultVariants: {
      type: 'none',
    },
  },
);

export interface SpanProps
  extends React.ComponentPropsWithoutRef<'span'>,
    VariantProps<typeof spanVariants> {
  asChild?: boolean;
}

const Span = React.forwardRef<HTMLSpanElement, SpanProps>(
  (
    {
      className,
      type,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'span';
    return (
      <Comp
        className={cn(
          spanVariants({
            type,
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Span.displayName = 'Span';

export { Span, spanVariants};
