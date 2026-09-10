export interface CourseModule {
  number: number;
  title: string;
  description: string;
  topics: string[];
  outcome: string;
}

export const COURSE = {
  name: 'A.I. Automation for Contractors',
  tagline: 'Save 10+ hours a week without hiring more staff',
  price: 197,
  priceFormatted: '$197',
  description:
    'A practical, no-fluff course that shows construction business owners how to use everyday AI tools to win bids faster, manage crews better, and stop drowning in paperwork. Four written PDF guides you can read on your phone at the job site.',
  totalModules: 4,
  format: 'Four PDF guides — read at your own pace',
  duration: 'Self-paced — no videos to sit through',
  level: 'No tech experience needed',
};

export const MODULES: CourseModule[] = [
  {
    number: 1,
    title: 'Finding & Winning Bids with AI',
    description:
      'Stop spending your evenings writing proposals. Learn how to use AI to scan plans, draft bids, and put together professional estimates in a fraction of the time.',
    topics: [
      'Scanning blueprints and spec sheets with AI',
      'Drafting professional proposals in minutes',
      'Writing follow-up emails that win the job',
      'Researching competitors and material costs fast',
    ],
    outcome: 'Cut your bid-writing time from hours to minutes.',
  },
  {
    number: 2,
    title: 'Crew Management & Daily Operations',
    description:
      'Turn scattered texts and phone calls into organized daily plans. Use AI to schedule crews, write daily reports, and keep everyone on the same page.',
    topics: [
      'Generating daily work schedules automatically',
      'Writing safety briefings and toolbox talks',
      'Creating clear instructions for subs and crews',
      'Tracking project progress with simple prompts',
    ],
    outcome: 'Run your crews like a well-oiled machine.',
  },
  {
    number: 3,
    title: 'Paperwork, Invoices & Change Orders',
    description:
      'The part nobody enjoys — made simple. Learn how to generate invoices, change orders, RFIs, and compliance docs without starting from scratch every time.',
    topics: [
      'Creating invoices and payment requests instantly',
      'Writing professional change orders',
      'Generating RFIs and submittals',
      'Organizing project documents in one place',
    ],
    outcome: 'Get paperwork done before lunch instead of after dinner.',
  },
  {
    number: 4,
    title: 'Marketing & Growing Your Business',
    description:
      'Build a steady pipeline of work without paying a marketing agency. Use AI to write your website, social posts, and email campaigns that attract the right clients.',
    topics: [
      'Writing website copy that sounds like you',
      'Creating a month of social posts in one sitting',
      'Emailing past clients for repeat work',
      'Building a simple referral system',
    ],
    outcome: 'Never wonder where the next job is coming from.',
  },
];
