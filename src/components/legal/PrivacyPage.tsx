// DRAFT: to be reviewed (ideally by a lawyer) before launch. This is not legal
// advice. Every <Placeholder> must be confirmed or replaced first (docs/LAUNCH_CHECKLIST.md).
import React from 'react';
import { BUSINESS } from './business';
import { Bullets, ContactEmail, LegalPage, Section, Placeholder } from './LegalKit';

export const PrivacyPage: React.FC = () => (
  <LegalPage
    title="Privacy Policy"
    intro="What we collect, why, and who we share it with. The short version: your child's drawing is made into a print on your own phone, and only the finished print file ever leaves it."
  >
    <Section title="Who we are">
      <p>
        {BUSINESS.tradingName} is run by {BUSINESS.legalName} (ABN {BUSINESS.abn}), based in {BUSINESS.location}.
        When this policy says "we" or "us", it means {BUSINESS.legalName}. We handle personal information in line
        with the Australian Privacy Principles in the Privacy Act 1988.
      </p>
    </Section>

    <Section title="Your child's drawing">
      <Bullets
        items={[
          'When you choose a photo, both looks (As drawn and Screen print) are made on your phone, in your browser. Your photo is not uploaded while you choose.',
          'When you order, only the finished print file is uploaded. It is kept in private storage, not at a public web address.',
          'We share the print file with Gelato, our print partner, so they can print your order.',
          'We use the print file only to make and deliver your order. We will not use it for anything else, such as advertising, without asking you first.',
          "If your child's name or anything else personal is written on the drawing, it will be in the print file too.",
        ]}
      />
    </Section>

    <Section title="What we collect when you order">
      <Bullets
        items={[
          'Your name, email address and delivery address, so we can make your order, send it, and tell you about it.',
          'What you ordered and what you paid.',
          'Your payment details. These go straight to Stripe, which takes the payment. We never see or store your full card number.',
        ]}
      />
      <p>You do not need an account. Your email address is collected at checkout, through Stripe.</p>
    </Section>

    <Section title="Emails">
      <Bullets
        items={[
          'We use your email address to send your receipt and to contact you about your order.',
          'At checkout you can choose to get marketing emails from us. This is optional. We only send them if you say yes.',
          'Every marketing email has an unsubscribe link, and you can unsubscribe at any time. Unsubscribing does not stop emails about an order you have placed.',
        ]}
      />
    </Section>

    <Section title="Who we share it with">
      <Bullets
        items={[
          'Gelato, our print partner: the print file, your name and your delivery address, to print and deliver your order.',
          'Stripe: to take your payment.',
          <>
            The companies that host this website and store order details and print files for us:{' '}
            <Placeholder confirm="name the hosting and storage providers">
              Supabase (order details and print files) and our website host
            </Placeholder>
            .
          </>,
        ]}
      />
      <p>
        Gelato and Stripe handle your information under their own privacy policies. We do not sell your
        information. We will share it with others only if the law requires us to.
      </p>
    </Section>

    <Section title="Information handled outside Australia">
      <p>
        Stripe and Gelato work internationally, and Gelato may print your order in another country, close to
        where it is being delivered. So your information may be handled outside Australia, including in{' '}
        <Placeholder confirm="the countries where print files and order details are stored and processed">
          Australia, the United States and the European Union
        </Placeholder>
        .
      </p>
    </Section>

    <Section title="How long we keep it">
      <Bullets
        items={[
          <>
            <Placeholder confirm="the 90-day period, and that the deletion job is actually set up (it is not yet)">
              Print files: we delete them 90 days after your order is delivered, which leaves time to sort out a
              reprint if something goes wrong.
            </Placeholder>
          </>,
          <>
            Order records (what you bought, what you paid, where it went): we keep these for{' '}
            <Placeholder confirm="how long order records are kept">5 years, as Australian tax records require</Placeholder>.
          </>,
        ]}
      />
    </Section>

    <Section title="Cookies">
      <p>
        This site does not use advertising or analytics cookies. It keeps a small amount of information in your
        browser so the site works, and that stays on your device. Stripe may use cookies when you pay, to take the
        payment and prevent fraud.
      </p>
    </Section>

    <Section title="Your choices">
      <p>
        You can ask for a copy of the information we hold about you, ask us to correct it, or ask us to delete it.
        We may need to keep order records the law requires us to keep. Email us at <ContactEmail />.
      </p>
    </Section>

    <Section title="Children">
      <p>
        {BUSINESS.tradingName} is for parents and carers. Children's drawings are made into prints here, but we do
        not knowingly collect personal information from children.
      </p>
    </Section>

    <Section title="Complaints">
      <p>
        If you are unhappy with how we have handled your information, email us at <ContactEmail /> and we will
        work with you to put it right. If you are still not satisfied, you can contact the Office of the Australian
        Information Commissioner at{' '}
        <a href="https://www.oaic.gov.au" className="underline underline-offset-2 hover:text-terracotta" rel="noopener noreferrer" target="_blank">
          oaic.gov.au
        </a>
        .
      </p>
    </Section>

    <Section title="Changes to this policy">
      <p>If we change this policy, we will update this page and the date at the top.</p>
    </Section>
  </LegalPage>
);
