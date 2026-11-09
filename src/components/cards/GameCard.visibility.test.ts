import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { specialCards } from '@/data';
import { resolvePlayerCard } from '@/engine/cards';
import { GameCard } from './GameCard';
import { useRunStore } from '@/store/runStore';
import { useProfileStore } from '@/store/profileStore';
import { generateDailyConfig } from '@/lib/daily';
import type { Difficulty } from '@/engine/types';

describe('special artwork visibility contract shared by all draft modes', () => {
  const sp = specialCards.find(s=>s.id==='sp-torsos-oce-longevity')!;
  const card = resolvePlayerCard(sp.baseCardId,sp.id);
  for (const collected of [true,false]) {
    it(`shows local and explicit art while keeping overall hidden, collected=${collected}`, () => {
      for (const special of [card.special!, { ...card.special!, imageUrl: '/qa-explicit-photo.png' }]) {
        const html=renderToStaticMarkup(React.createElement(GameCard,{card:{...card,special},showOverall:false,specialCollected:collected}));
        expect(html).toContain(special.imageUrl ? 'qa-explicit-photo' : `${sp.id}.png`);
        expect(html).toMatch(/class="[^"]*ovr-[^"]*"[^>]*>\?\?<\/span>/);
        expect(html).toContain(card.orgName!);
      }
    });
    it(`restores art on visible draft and final reveal, collected=${collected}`, () => {
      const html=renderToStaticMarkup(React.createElement(GameCard,{card,showOverall:true,specialCollected:collected}));
      expect(html).toContain(`${sp.id}.png`);
    });
  }
});

describe('run overall visibility never hides special photos', () => {
  afterEach(() => { vi.useRealTimers(); useRunStore.setState({ run: null }); });
  const sp = specialCards.find(s => s.id === 'sp-torsos-oce-longevity')!;
  const card = resolvePlayerCard(sp.baseCardId, sp.id);
  const hasArt = (visible: boolean) => renderToStaticMarkup(React.createElement(GameCard,{card,showOverall:visible})).includes(`${sp.id}.png`);
  for (const mode of ['classic', 'quick'] as const) {
    for (const difficulty of ['easy','normal','hard','legacy'] as Difficulty[]) {
      it(`${mode}/${difficulty}: optional and forced-hidden settings, including restart`, () => {
        for (const requested of [false,true]) {
          useRunStore.getState().startRun({ mode, difficulty, showOverall: requested });
          const expected = requested && (difficulty === 'easy' || difficulty === 'normal');
          expect(useRunStore.getState().run?.showOverall).toBe(expected);
          expect(hasArt(useRunStore.getState().run!.showOverall)).toBe(true);
          useRunStore.getState().restartRun();
          expect(useRunStore.getState().run?.showOverall).toBe(expected);
          expect(hasArt(useRunStore.getState().run!.showOverall)).toBe(true);
        }
      });
    }
  }
  it('each playable region retains the same hidden/visible contract', () => {
    for (const regionLock of ['NA','EU','SAM','OCE','MENA'] as const) {
      for (const showOverall of [false,true]) {
        useRunStore.getState().startRun({mode:'classic', difficulty:'normal', regionLock, showOverall});
        expect(hasArt(useRunStore.getState().run!.showOverall)).toBe(true);
      }
    }
  });
  it('daily templates decide visibility themselves, including hidden and visible days', () => {
    vi.useFakeTimers();
    const seen = new Set<boolean>();
    for (let day=9; day<54 && seen.size<2; day++) {
      const date = new Date(Date.UTC(2026,10,day,12));
      const config = generateDailyConfig(date.toISOString().slice(0,10));
      const expected = !config.hiddenOverall;
      if (seen.has(expected)) continue;
      vi.setSystemTime(date);
      useRunStore.getState().startDailyRun();
      expect(useRunStore.getState().run?.mode).toBe('daily');
      expect(useRunStore.getState().run?.showOverall).toBe(expected);
      expect(hasArt(useRunStore.getState().run!.showOverall)).toBe(true);
      seen.add(expected);
    }
    expect(seen.size).toBe(2);
  });
  it('authored challenges keep their visible art', () => {
    useProfileStore.setState({xp:100000});
    useRunStore.getState().startChallenge('ch-first-final');
    expect(useRunStore.getState().run?.mode).toBe('challenge');
    expect(useRunStore.getState().run?.showOverall).toBe(true);
    expect(hasArt(useRunStore.getState().run!.showOverall)).toBe(true);
  });
});
