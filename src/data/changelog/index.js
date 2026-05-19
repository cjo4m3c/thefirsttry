/**
 * Changelog data — re-exports CHANGELOG (newest first) by concatenating
 * `current` (tip, edited per PR) with frozen archive chunks `c01`..`c32` (oldest).
 */
import current from './current.js';
import c32 from './c32.js';
import c31 from './c31.js';
import c30 from './c30.js';
import c29 from './c29.js';
import c28 from './c28.js';
import c27 from './c27.js';
import c26 from './c26.js';
import c25 from './c25.js';
import c24 from './c24.js';
import c23 from './c23.js';
import c22 from './c22.js';
import c21 from './c21.js';
import c20 from './c20.js';
import c19 from './c19.js';
import c18 from './c18.js';
import c17 from './c17.js';
import c16 from './c16.js';
import c15 from './c15.js';
import c14 from './c14.js';
import c13a from './c13a.js';
import c13b from './c13b.js';
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
  ...c32,
  ...c31,
  ...c30,
  ...c29,
  ...c28,
  ...c27,
  ...c26,
  ...c25,
  ...c24,
  ...c23,
  ...c22,
  ...c21,
  ...c20,
  ...c19,
  ...c18,
  ...c17,
  ...c16,
  ...c15,
  ...c14,
  ...c13a,
  ...c13b,
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
