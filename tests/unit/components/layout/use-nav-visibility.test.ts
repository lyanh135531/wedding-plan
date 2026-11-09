import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useNavVisibility } from '@/hooks/useNavVisibility';

describe('useNavVisibility Hook (UI/UX Spec §2.3)', () => {
  it('returns true when modal is closed in standard SSR/initial state', () => {
    let captured: boolean | null = null;

    const Consumer = () => {
      captured = useNavVisibility(false);
      return null;
    };

    renderToStaticMarkup(React.createElement(Consumer));
    expect(captured).toBe(true);
  });

  it('returns false when modal is open to auto-hide mobile nav', () => {
    let captured: boolean | null = null;

    const Consumer = () => {
      captured = useNavVisibility(true);
      return null;
    };

    renderToStaticMarkup(React.createElement(Consumer));
    expect(captured).toBe(false);
  });
});
