// DRAFT: to be reviewed before launch. This is not legal advice. Every
// <Placeholder> must be confirmed or replaced first (docs/LAUNCH_CHECKLIST.md).
import React from 'react';
import { AppView } from '../../types/types';
import { BUSINESS } from './business';
import { ContactEmail, LegalPage, LegalPageNav, PageLink, Section } from './LegalKit';

export const ContactPage: React.FC<LegalPageNav> = ({ onNavigate }) => (
  <LegalPage
    title="Contact"
    dated={false}
    intro="A question about an order, a print, or anything else? Email us."
  >
    <Section title="Email">
      <p className="text-lg">
        <ContactEmail />
      </p>
      <p>
        If it is about an order, please include your order number. If something has arrived damaged or faulty,
        please send a photo of the problem too. Our{' '}
        <PageLink onNavigate={onNavigate} to={AppView.SHIPPING}>
          Shipping &amp; Returns
        </PageLink>{' '}
        page explains what happens next.
      </p>
    </Section>

    <Section title="Who we are">
      <p>
        {BUSINESS.tradingName} is run by {BUSINESS.legalName}, ABN {BUSINESS.abn}, based in {BUSINESS.location}.
      </p>
    </Section>
  </LegalPage>
);
