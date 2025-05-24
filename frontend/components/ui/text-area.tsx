import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/tailwind-utils';

const textAreaVariants = cva('textarea',
  {
    variants: {
      size: {
        default: 'textarea-md',
        sm: 'textarea-sm',
        lg: 'textarea-lg'
      }
    },
    defaultVariants: {
      size: 'default'
    },
  },
);

export interface TextAreaProps
  extends React.ComponentPropsWithoutRef<'textarea'>,
    VariantProps<typeof textAreaVariants> {
  asChild?: boolean;
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'textarea';
    return (
      <Comp
        className={cn(
          textAreaVariants({
            className,
          }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
TextArea.displayName = 'FieldSet';

export { TextArea, textAreaVariants};
