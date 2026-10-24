/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { gridAppearance } from '../environmentVisuals';

describe('gridAppearance', () => {
  it('draws the grid at the configured opacity while it is shown', () => {
    expect(gridAppearance(true, 0.4)).toEqual({ visible: true, opacity: 0.4 });
  });

  it('hides the grid when it is switched off, whatever its opacity', () => {
    expect(gridAppearance(false, 0.4)).toEqual({ visible: false, opacity: 0.4 });
  });

  it('hides the grid at zero opacity', () => {
    expect(gridAppearance(true, 0).visible).toBe(false);
  });
});
