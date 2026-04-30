/**
 * Changelog data — re-exports CHANGELOG (newest first) by concatenating
 * `current` (tip, edited per PR) with frozen archive chunks `c01`..`c20` (oldest).
 */
import current from './current.js';
import c20 from './c20.js';
import c19 from './c19.js';
import c18 from './c18.js';
import c17 from './c17.js';
import c16 from './c16.js';
import c15 from './c15.js';
import c14 from './c14.js';
import c13 from './c13.js';
import c12 from './c12.js';
import c11 from './c11.js';
import c10 from './c10.js';
import c09 from './c09.js';
import c08 from './c08.js';
import c07 from './c07.js';
import c06 from './c06.js';
import c05 from './c05.js';
import c04 from './c04.js';
import c03 from './c03.js';
import c02 from './c02.js';
import c01 from './c01.js';

export const CHANGELOG = [
  ...current,
  ...c20,
  ...c19,
  ...c18,
  ...c17,
  ...c16,
  ...c15,
  ...c14,
  ...c13,
  ...c12,
  ...c11,
  ...c10,
  ...c09,
  ...c08,
  ...c07,
  ...c06,
  ...c05,
  ...c04,
  ...c03,
  ...c02,
  ...c01,
];
