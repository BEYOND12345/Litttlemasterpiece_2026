// DRAFT: to be reviewed (ideally by a lawyer) before launch. This is not legal
// advice. Every <Placeholder> must be confirmed or replaced first (docs/LAUNCH_CHECKLIST.md).
import React from 'react';
import { AppView } from '../../types/types';
import { Bullets, ContactEmail, LegalPage, LegalPageNav, PageLink, Section, Placeholder } from './LegalKit';

export const ShippingReturnsPage: React.FC<LegalPageNav> = ({ onNavigate }) => (
  <LegalPage
    title="Shipping & Returns"
    intro="Every Little Masterpiece is made to order from your child's drawing, then printed and posted by our print partner, Gelato."
  >
    <Section title="Where we deliver">
      <p>
        We deliver worldwide. Gelato prints in many countries, so your order may be printed close to where it is
        going.
      </p>
    </Section>

    <Section title="Delivery times and costs">
      <Bullets
        items={[
          <>
            Delivery times:{' '}
            <Placeholder confirm="delivery times by region, from Gelato">
              most orders are printed within a few business days and arrive within about 1 to 2 weeks, depending
              on where you are.
            </Placeholder>
          </>,
          <>
            Christmas:{' '}
            <Placeholder confirm="last order dates for Christmas delivery, by region, from Gelato">
              we'll post last order dates for Christmas delivery here. Order early to be safe.
            </Placeholder>
          </>,
          <>
            Shipping cost:{' '}
            <Placeholder confirm="whether shipping is included in the price or charged at checkout, and how much">
              standard shipping is included in the price.
            </Placeholder>
          </>,
          <>
            Outside Australia:{' '}
            <Placeholder confirm="whether customers outside Australia may pay import duties or local taxes">
              orders are printed close to where they are going wherever possible. If import duties or local taxes
              apply, they are paid on delivery.
            </Placeholder>
          </>,
          'Prices are in Australian dollars (AUD) and include GST. If your card is in another currency, your card provider converts the amount.',
        ]}
      />
    </Section>

    <Section title="Check your address">
      <p>
        Please check your delivery address before you pay. Orders go to print quickly, so we may not be able to
        change it afterwards. If you spot a mistake, email us at <ContactEmail /> straight away.
      </p>
    </Section>

    <Section title="Damaged, faulty or not what you ordered">
      <p>
        If your order arrives damaged or faulty, or it is not what you ordered, we will reprint it or refund you.
      </p>
      <p>
        Email us at <ContactEmail /> with your order number and a photo of the problem, and we will sort it out with
        Gelato.
      </p>
      <p className="bg-white border border-stone-200 p-5">
        Our goods come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled
        to a replacement or refund for a major failure and compensation for any other reasonably foreseeable loss or
        damage. You are also entitled to have the goods repaired or replaced if the goods fail to be of acceptable
        quality and the failure does not amount to a major failure.
      </p>
    </Section>

    <Section title="If your order does not arrive">
      <p>
        If your order has not arrived within the delivery time above, email us. We will chase it with Gelato, and if
        it has been lost, we will reprint it or refund you.
      </p>
    </Section>

    <Section title="Change of mind">
      <p>
        Every item is personalised and made to order from your child's drawing, so we cannot accept returns or give
        refunds if you change your mind, except where the law requires us to. This does not affect your rights if an
        item is damaged or faulty.
      </p>
    </Section>

    <Section title="If you live outside Australia">
      <p>
        Everything on this page applies wherever you live. You also keep any rights your own country's consumer
        laws give you.
      </p>
    </Section>

    <Section title="Questions">
      <p>
        <PageLink onNavigate={onNavigate} to={AppView.CONTACT}>
          Contact us
        </PageLink>{' '}
        and include your order number if you have one.
      </p>
    </Section>
  </LegalPage>
);
