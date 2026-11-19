import { IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';

import { Button } from '@components/Button';
import { Modal } from '@components/Modal';

type Props = { onStartOver: () => void; disabled?: boolean };

/** Clears the room after an "are you sure?". */
export function StartOver({ onStartOver, disabled }: Props) {
  const [asking, setAsking] = useState(false);
  const close = () => setAsking(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setAsking(true)} disabled={disabled}>
        <IconRefresh className="size-5" aria-hidden />
        Clear the room
      </Button>
      {asking && (
        <Modal
          title="Clear the room?"
          onClose={close}
          footer={
            <div className="flex flex-wrap justify-end gap-3">
              {/* Focus lands on the safe choice. */}
              <Button variant="secondary" data-autofocus onClick={close}>
                Keep my room
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  onStartOver();
                  close();
                }}
              >
                Yes, clear it
              </Button>
            </div>
          }
        >
          <p className="text-base">The shape and the teammates’ desks go back to an empty room. Your desk and furniture, doors, windows and teammates stay. Undo can bring it back.</p>
        </Modal>
      )}
    </>
  );
}
