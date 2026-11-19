import { useState, type ComponentProps } from 'react';

import { TextField } from '@components/TextField';

type Props = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>;

/** A password input with a Show / Hide button, handy on tablets. */
export function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          className="min-h-11 min-w-20 cursor-pointer rounded-lg px-3 text-base font-medium text-sage-ink hover:bg-hover"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
