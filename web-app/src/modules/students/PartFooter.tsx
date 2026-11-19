import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';

import { Button } from '@components/Button';

type Props = {
  backLabel?: string;
  onBack?: () => void;
  nextLabel: string;
  onNext: () => void;
};

/** A back arrow and one big button naming what comes next. */
export function PartFooter({ backLabel = 'Back', onBack, nextLabel, onNext }: Props) {
  return (
    <div className="mt-4 flex flex-wrap justify-between gap-3 print:hidden">
      {onBack ? (
        <Button variant="secondary" onClick={onBack}>
          <IconArrowLeft className="size-5" aria-hidden />
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onNext}>
        {nextLabel}
        <IconArrowRight className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
