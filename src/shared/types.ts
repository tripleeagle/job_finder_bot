export type Cadence = 'instant' | 'daily' | 'weekly';

export type Criteria = {
  // Any of these substrings must appear in title/description/location/employmentType.
  keywords: string[];
  // Any of these substrings must appear. Empty means no location filter.
  locations: string[];
  // Allowed employment types. Empty means no employment filter.
  // Anything in `excludeEmployment` overrides this.
  employmentTypes: EmploymentType[];
  // Substrings in title/description that disqualify a job (e.g. "internship").
  excludeEmployment: string[];
  // Title substrings that disqualify ("senior", "lead", etc).
  excludeSeniority: string[];
};

export type EmploymentType =
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'internship'
  | 'dpp'
  | 'dpc';

export type User = {
  id: string;
  email: string;
  criteria: Criteria;
  cadence: Cadence;
  verified_at: string | null;
  unsubscribe_token: string;
};
