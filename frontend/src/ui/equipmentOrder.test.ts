import { describe, expect, it } from 'vitest';
import type { EquipmentContext } from '../api/types';
import { DEFAULT_CONTEXT_ID, orderContexts } from './EquipmentPicker';

const unit = (id: string): EquipmentContext => ({ id }) as EquipmentContext;

describe('orderContexts', () => {
  it('lists the Goodman GSZB4 first and keeps the rest in catalog order', () => {
    const ordered = orderContexts([unit('generic-ac'), unit('generic-furnace'), unit(DEFAULT_CONTEXT_ID)]);
    expect(ordered.map((item) => item.id)).toEqual([DEFAULT_CONTEXT_ID, 'generic-ac', 'generic-furnace']);
  });

  it('leaves the list alone when the featured unit is missing', () => {
    expect(orderContexts([unit('generic-ac'), unit('generic-furnace')]).map((item) => item.id))
      .toEqual(['generic-ac', 'generic-furnace']);
  });
});
