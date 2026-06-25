export type Job = {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  employmentType?: string;
};

export type Source = {
  name: string;
  fetch: () => Promise<Job[]>;
};
