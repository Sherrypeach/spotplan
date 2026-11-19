type Props = {
  message: string | null;
};

/**
 * An error about the whole form (e.g. "wrong password"), read out as soon as
 * it appears. Errors about one field belong on that field instead.
 */
export function FormError({ message }: Props) {
  return (
    <p role="alert" className="text-center text-base text-danger empty:hidden">
      {message}
    </p>
  );
}
