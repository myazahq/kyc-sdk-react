import type { TextEntry } from '../types';

/** The pin step and the moved-pin question. */
export const ADDRESS_PIN_ENTRIES: TextEntry[] = [
  { key: 'address.pin.title', label: 'Pin: title', default: 'Is the pin on your building?' },
  { key: 'address.pin.title.business', label: 'Pin: title (business)', default: 'Is the pin on the premises?' },
  {
    key: 'address.pin.description',
    label: 'Pin: description',
    default: 'Drag the map until the pin sits exactly on it. You can add details for whoever needs to find it.',
    multiline: true,
  },
  { key: 'address.pin.noPin', label: 'Pin: no pin yet', default: 'No pin placed yet' },
  { key: 'address.line.unavailable', label: 'No address for the pin', default: 'No address found for this spot' },
  {
    key: 'address.pin.detailsAdded.one',
    label: 'Pin: details added (one)',
    default: '{count} detail added',
    placeholders: ['count'],
  },
  {
    key: 'address.pin.detailsAdded.other',
    label: 'Pin: details added (several)',
    default: '{count} details added',
    placeholders: ['count'],
  },
  {
    key: 'address.pin.detailsHint',
    label: 'Pin: details hint',
    default: 'A house number and directions help someone find it',
  },
  { key: 'address.pin.editDetails', label: 'Pin: edit details button', default: 'Edit details' },
  { key: 'address.locate.button', label: 'Map: use my location button', default: 'Use my location' },
  { key: 'address.locate.finding', label: 'Map: finding you', default: 'Finding you…' },
  { key: 'address.labelDecision.title', label: 'Moved pin: title', default: 'You moved the pin' },
  {
    key: 'address.labelDecision.body',
    label: 'Moved pin: question',
    default: 'Keep {label} as your address, or update it to match the new spot?',
    placeholders: ['label'],
    multiline: true,
  },
  { key: 'address.labelDecision.keep', label: 'Moved pin: keep button', default: 'Keep this address' },
  { key: 'address.labelDecision.adopt', label: "Moved pin: use the pin's address button", default: 'Use the pin’s address' },
  {
    key: 'address.missingFields',
    label: 'Error: required details missing',
    default: 'This flow needs: {fields}.',
    placeholders: ['fields'],
  },
  { key: 'address.missingFields.add', label: 'Error: add missing details link', default: 'Add them' },
  { key: 'address.confirming', label: 'Confirming', default: 'Confirming…' },
];
