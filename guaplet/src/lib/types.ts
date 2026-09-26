export type Module = {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
};

export type Lesson = {
  id: string;
  module_id: string;
  slug: string;
  title: string;
  summary: string;
  body_markdown: string;
  estimated_minutes: number;
  position: number;
};

export type LessonProgress = {
  lesson_id: string;
  status: "not_started" | "in_progress" | "completed";
  started_at: string | null;
  completed_at: string | null;
};

export type Opportunity = {
  id: string;
  provider_name: string;
  title: string;
  opportunity_type: string;
  description: string;
  eligibility: string | null;
  pay_basis: string;
  compensation_disclosure: string;
  effort_expectation: string | null;
  fees_costs: string;
  payout_timing: string | null;
  geography: string | null;
  application_url: string;
  last_reviewed_at: string | null;
  referral_disclosure: string | null;
  referral_url: string | null;
};

export type Disclosure = {
  key: string;
  title: string;
  body_markdown: string;
  version: string;
};

export type Profile = {
  user_id: string;
  display_name: string | null;
};
