import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  EventScopeProvider,
  useEventScope,
  WeddingEventItem,
  EventScopeContextValue,
} from '@/context/EventScopeContext';

const MOCK_EVENTS: WeddingEventItem[] = [
  { id: 'ev-an-hoi', name: 'Lễ Ăn Hỏi', isRepresentative: false },
  { id: 'ev-tiec-cuoi', name: 'Tiệc Cưới Chính', isRepresentative: true },
  { id: 'ev-lai-mat', name: 'Lễ Lại Mặt', isCancelled: true },
];

describe('EventScopeContext & Dirty Form Protection Engine', () => {
  it('throws an error if useEventScope is used outside of EventScopeProvider', () => {
    const Consumer = () => {
      useEventScope();
      return null;
    };

    expect(() => {
      renderToStaticMarkup(React.createElement(Consumer));
    }).toThrow('useEventScope must be used within an EventScopeProvider');
  });

  it('provides initial scope and available events for Owner', () => {
    let captured: EventScopeContextValue | null = null;

    const Consumer = () => {
      captured = useEventScope();
      return React.createElement('div', null, captured.currentScope);
    };

    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS, initialScope: 'all' },
        React.createElement(Consumer)
      )
    );

    renderToStaticMarkup(tree);

    expect(captured).not.toBeNull();
    expect(captured!.currentScope).toBe('all');
    expect(captured!.availableEvents.length).toBe(3);
    expect(captured!.isAnyFormDirty).toBe(false);
    expect(captured!.showDirtyGuardModal).toBe(false);
  });

  it('filters available events strictly for Family View based on allowedEventIds', () => {
    let captured: EventScopeContextValue | null = null;

    const Consumer = () => {
      captured = useEventScope();
      return null;
    };

    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'family_view', initialAllowedEventIds: ['ev-tiec-cuoi'] },
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS, initialScope: 'ev-tiec-cuoi' },
        React.createElement(Consumer)
      )
    );

    renderToStaticMarkup(tree);

    expect(captured).not.toBeNull();
    expect(captured!.currentScope).toBe('ev-tiec-cuoi');
    expect(captured!.availableEvents.length).toBe(1);
    expect(captured!.availableEvents[0].id).toBe('ev-tiec-cuoi');
    expect(captured!.availableEvents[0].name).toBe('Tiệc Cưới Chính');
  });

  it('allows immediate scope change when no forms are dirty', () => {
    let captured: EventScopeContextValue | null = null;

    const TestHarness = () => {
      const scopeCtx = useEventScope();
      captured = scopeCtx;

      return React.createElement(
        'button',
        {
          onClick: () => scopeCtx.setScope('ev-an-hoi'),
        },
        'Change Scope'
      );
    };

    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS, initialScope: 'all' },
        React.createElement(TestHarness)
      )
    );

    renderToStaticMarkup(tree);

    // Initial state
    expect(captured!.currentScope).toBe('all');
    expect(captured!.isAnyFormDirty).toBe(false);

    // Call setScope directly
    captured!.setScope('ev-an-hoi');
    expect(captured!.pendingScopeChange).toBeNull();
    expect(captured!.showDirtyGuardModal).toBe(false);
  });

  it('Dirty Form Guard: blocks scope change and displays modal when a form is dirty', () => {
    let captured: EventScopeContextValue | null = null;

    const Consumer = () => {
      captured = useEventScope();
      return null;
    };

    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        {
          initialEvents: MOCK_EVENTS,
          initialScope: 'all',
          initialDirtyForms: { 'guest-form': true },
        },
        React.createElement(Consumer)
      )
    );

    renderToStaticMarkup(tree);

    expect(captured).not.toBeNull();
    // 1. Initial state with dirty form
    expect(captured!.isAnyFormDirty).toBe(true);
    expect(captured!.currentScope).toBe('all');
    expect(captured!.pendingScopeChange).toBeNull();
    expect(captured!.showDirtyGuardModal).toBe(false);

    // 2. Attempt scope change while form is dirty -> blocked & modal requested
    captured!.setScope('ev-tiec-cuoi');
    expect(captured!.currentScope).toBe('all'); // scope change blocked
    expect(captured!.pendingScopeChange).toBe('ev-tiec-cuoi');
    expect(captured!.showDirtyGuardModal).toBe(true);

    // 3. User cancels scope change ("Ở lại biểu mẫu") -> pending change discarded
    captured!.cancelScopeChange();
    expect(captured!.currentScope).toBe('all');
    expect(captured!.pendingScopeChange).toBeNull();
    expect(captured!.showDirtyGuardModal).toBe(false);
    expect(captured!.isAnyFormDirty).toBe(true); // form is still dirty

    // 4. Attempt scope change again and confirm ("Bỏ thay đổi & Chuyển buổi")
    captured!.setScope('ev-tiec-cuoi');
    expect(captured!.pendingScopeChange).toBe('ev-tiec-cuoi');
    expect(captured!.showDirtyGuardModal).toBe(true);

    captured!.confirmScopeChange();
    expect(captured!.currentScope).toBe('ev-tiec-cuoi'); // scope updated
    expect(captured!.pendingScopeChange).toBeNull();
    expect(captured!.showDirtyGuardModal).toBe(false);
    expect(captured!.isAnyFormDirty).toBe(false); // dirty state cleared
  });

  it('tracks dirty forms via registerDirtyForm and unregisterDirtyForm dynamically', () => {
    let captured: EventScopeContextValue | null = null;

    const Consumer = () => {
      captured = useEventScope();
      return null;
    };

    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS, initialScope: 'all' },
        React.createElement(Consumer)
      )
    );

    renderToStaticMarkup(tree);

    expect(captured!.isAnyFormDirty).toBe(false);

    captured!.registerDirtyForm('modal-1', true);
    expect(captured!.isAnyFormDirty).toBe(true);

    captured!.registerDirtyForm('modal-2', true);
    expect(captured!.isAnyFormDirty).toBe(true);

    captured!.registerDirtyForm('modal-1', false);
    expect(captured!.isAnyFormDirty).toBe(true);

    captured!.unregisterDirtyForm('modal-2');
    expect(captured!.isAnyFormDirty).toBe(false);
  });
});
