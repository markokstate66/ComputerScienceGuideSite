export const SITE = {
  name: 'Computer Science Guide',
  url: 'https://www.computerscienceguide.com',
  tagline: 'Computer science fundamentals, explained with C# you can run.',
  description:
    'Computer science fundamentals explained by a working .NET developer: data structures, algorithms, complexity, databases, networking and more, with every code example compiled and run.',
  gaId: 'G-08FYJQ54RN',
  productionHosts: ['www.computerscienceguide.com', 'computerscienceguide.com'],
} as const;

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** JSON-LD must not contain a raw "</script>" or "<!--". */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\u003c');
