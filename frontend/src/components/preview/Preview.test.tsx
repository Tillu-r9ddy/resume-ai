/**
 * Preview.test.tsx — render the live document and assert sections appear.
 *
 * Why test the Preview and not a smaller unit?
 *   The Preview is the consolidator — it stitches together selectSections,
 *   the section-type switch, and every PreviewXxx renderer. A test here
 *   covers a representative slice of the read path in one render.
 *
 * Why a per-test store?
 *   The real `store` is wired with redux-persist and rehydrates on mount,
 *   which makes for noisy tests. A fresh `configureStore` per test renders
 *   instantly with deterministic seed data.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { Preview } from './Preview';
import { resumeReducer } from '../../store/resumeSlice';
import type { Resume } from '../../schema/resume';

function makeStore(present: Resume) {
  return configureStore({
    reducer: { resume: (s = { past: [], present, future: [] }) => s },
  });
}

const seed: Resume = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Test resume',
  sections: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'header',
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        fullName: 'Ada Lovelace',
        headline: 'Mathematician',
        email: '',
        phone: '',
        location: 'London',
        links: [],
      },
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      type: 'skills',
      items: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          group: 'Languages',
          items: ['Analytical Engine', 'Algebra'],
        },
      ],
    },
  ],
};

describe('Preview', () => {
  it('renders the header name and skills', () => {
    render(
      <Provider store={makeStore(seed)}>
        <Preview />
      </Provider>,
    );

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText(/Analytical Engine/)).toBeInTheDocument();
  });

  it('renders an empty-state message when no sections exist', () => {
    const empty: Resume = {
      id: '66666666-6666-4666-8666-666666666666',
      title: 'Blank',
      sections: [],
    };
    render(
      <Provider store={makeStore(empty)}>
        <Preview />
      </Provider>,
    );

    expect(screen.getByText(/no sections yet/i)).toBeInTheDocument();
  });
});

// Keep the unused reducer reference so the test file compiles even when the
// real reducer isn't used in makeStore. Importing it elsewhere is a future
// extension hook (e.g. dispatching real actions to assert re-render).
void resumeReducer;
