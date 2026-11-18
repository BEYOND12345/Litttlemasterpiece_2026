// DRAFT: shared layout for the legal pages. The pages it frames are drafts to
// be reviewed before launch, and are not legal advice.
import React from 'react';
import { AppView } from '../../types/types';
import { BUSINESS } from './business';

export interface LegalPageNav {
  onNavigate?: (view: AppView) => void;
}

/** A link to another page of the site, inline in running text. */
export const PageLink: React.FC<LegalPageNav & { to: AppView; children: React.ReactNode }> = ({ onNavigate, to, children }) =>
  onNavigate ? (
    <button
      type="button"
      onClick={() => onNavigate(to)}
      className="underline underline-offset-2 text-stone-900 hover:text-terracotta"
    >
      {children}
    </button>
  ) : (
    <>{children}</>
  );

/**
 * A placeholder fact standing in until the owner confirms it. It reads as
 * normal text so the preview is clean; `confirm` says what must be checked.
 * Every one is in docs/LAUNCH_CHECKLIST.md. Do not launch with any left:
 * `grep -rn "<Placeholder" src` must find none.
 */
export const Placeholder: React.FC<{ confirm: string; children: React.ReactNode }> = ({ confirm, children }) => (
  <span data-placeholder={confirm}>{children}</span>
);

/** The one contact address, used on every legal page. */
export const ContactEmail: React.FC = () => (
  <Placeholder confirm="contact email address">
    <a className="underline" href={`mailto:${BUSINESS.contactEmail}`}>{BUSINESS.contactEmail}</a>
  </Placeholder>
);

interface LegalPageProps {
  title: string;
  intro?: React.ReactNode;
  /** Show the "Last updated" line. The contact page has no effective date. */
  dated?: boolean;
  children: React.ReactNode;
}

export const LegalPage: React.FC<LegalPageProps> = ({ title, intro, dated = true, children }) => (
  <div className="bg-stone-50">
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
      <h1 className="font-serif text-4xl md:text-5xl text-stone-900 leading-tight mb-4">{title}</h1>
      {dated && (
        <p className="text-sm text-stone-500 mb-8">
          Last updated: <Placeholder confirm="the date these pages take effect">{BUSINESS.effectiveDate}</Placeholder>
        </p>
      )}
      {intro && <p className="text-lg text-stone-600 font-light leading-relaxed mb-12">{intro}</p>}
      <div className="space-y-12">{children}</div>
    </article>
  </div>
);

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h2 className="font-serif text-2xl text-stone-900 mb-4">{title}</h2>
    <div className="space-y-4 text-stone-700 leading-relaxed">{children}</div>
  </section>
);

export const Bullets: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="space-y-3">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-terracotta mt-2.5 shrink-0" aria-hidden="true" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);
