// DRAFT: to be reviewed (ideally by a lawyer) before launch. This is not legal
// advice. Every <Placeholder> must be confirmed or replaced first (docs/LAUNCH_CHECKLIST.md).
import React from 'react';
import { AppView } from '../../types/types';
import { BUSINESS } from './business';
import { Bullets, ContactEmail, LegalPage, LegalPageNav, PageLink, Section, Placeholder } from './LegalKit';

export const TermsPage: React.FC<LegalPageNav> = ({ onNavigate }) => (
  <LegalPage
    title="Terms"
    intro="These terms apply when you order from Little Masterpiece. They are written to be read, so please do."
  >
    <Section title="Who you are buying from">
      <p>
        {BUSINESS.tradingName} is run by {BUSINESS.legalName} (ABN {BUSINESS.abn}), based in {BUSINESS.location}.
        By placing an order, you agree to these terms.
      </p>
      <p>
        Nothing in these terms takes away your rights under the Australian Consumer Law. If you live outside
        Australia, you also keep the rights your own consumer laws give you.
      </p>
    </Section>

    <Section title="What we sell">
      <p>A framed print or an 11oz mug, made from a photo of your child's drawing, in one of two looks:</p>
      <Bullets
        items={[
          'As drawn: the drawing cleaned up and ready to print.',
          "Screen print: the drawing's own colours as one to three flat inks, for a screen-print look. It is printed digitally, not by hand.",
        ]}
      />
      <p>Every item is made to order. Printing is done by our print partner, Gelato.</p>
    </Section>

    <Section title="Your drawing">
      <Bullets
        items={[
          "Only upload a drawing you have the right to use, such as your own child's, or one whose artist's parent or carer has said yes.",
          'The drawing stays yours. You give us permission to use the print file only to make and deliver your order.',
          'If we cannot make an order, we will cancel it and refund you in full.',
        ]}
      />
    </Section>

    <Section title="Previews and colour">
      <p>
        The previews are made on your phone and show your child's drawing on the product. Screens and printers
        show colour differently, so printed colours can look a little different from your screen.
      </p>
    </Section>

    <Section title="Prices and payment">
      <Bullets
        items={[
          'Prices are in Australian dollars (AUD) and include GST.',
          'If your card is in another currency, your card provider converts the amount and may charge a fee.',
          'Payment is taken by Stripe when you order. You do not need an account.',
          <>
            Shipping:{' '}
            <Placeholder confirm="whether shipping is included in the price or charged at checkout, and how much">
              standard shipping is included in the price.
            </Placeholder>
          </>,
        ]}
      />
    </Section>

    <Section title="Changing or cancelling an order">
      <p>
        Orders go to print quickly, so we may not be able to change or cancel one after you have placed it. If you
        have made a mistake, email us at <ContactEmail /> straight away and we will do what we can.
      </p>
    </Section>

    <Section title="Delivery, faults and refunds">
      <p>
        Delivery, damaged or faulty items, and refunds are covered on our{' '}
        <PageLink onNavigate={onNavigate} to={AppView.SHIPPING}>
          Shipping &amp; Returns
        </PageLink>{' '}
        page, which forms part of these terms.
      </p>
    </Section>

    <Section title="Our responsibility">
      <p>
        As far as the law allows, we are not responsible for loss that was not a reasonably foreseeable result of us
        breaking these terms. This does not limit your rights under the Australian Consumer Law or your local
        consumer law.
      </p>
    </Section>

    <Section title="The law that applies">
      <p>
        These terms are governed by the laws of{' '}
        <Placeholder confirm="the governing state (New South Wales suggested, the business is in Byron Bay)">
          New South Wales
        </Placeholder>
        , Australia.
      </p>
    </Section>

    <Section title="Questions">
      <p>
        Email us at <ContactEmail />.
      </p>
    </Section>
  </LegalPage>
);
