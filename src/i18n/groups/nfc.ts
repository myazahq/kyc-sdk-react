import type { TextGroup } from '../types';

export const NFC_TEXTS: TextGroup = {
  id: 'nfc',
  title: 'Chip reading',
  entries: [
    { key: 'nfc.title', label: 'Title', default: 'Scan your document’s chip' },
    {
      key: 'nfc.description',
      label: 'Description',
      default: 'Hold your ID flat against the back of your phone and keep it still until scanning completes.',
      multiline: true,
    },
    { key: 'nfc.waiting', label: 'Waiting status', default: 'Waiting for your document…' },
    {
      key: 'nfc.deviceNote',
      label: 'Device note',
      default: 'Chip reading works on NFC-capable mobile devices. Desktop and phones without NFC skip this step.',
      multiline: true,
    },
    { key: 'nfc.skip', label: 'Skip button', default: 'My device can’t scan the chip. Skip' },
  ],
};
