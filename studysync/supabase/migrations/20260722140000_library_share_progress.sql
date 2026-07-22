-- Library expansion + share invites/comments + progress streaks
-- Safe to re-run (idempotent inserts / if-not-exists)

-- ---------------------------------------------------------------------------
-- 1) Expand premade library (skip titles that already exist)
-- ---------------------------------------------------------------------------
insert into public.library_items (title, subject, description, content)
select v.title, v.subject, v.description, v.content
from (values
  (
    'AP Chemistry - Stoichiometry',
    'Chemistry',
    'Mole ratios, limiting reactants, and percent yield for AP Chem.',
    E'# Stoichiometry\n\n## Mole concept\n1 mole = $6.022\\times10^{23}$ particles.\n\n## Balancing\nConserve atoms on both sides of the equation.\n\n## Limiting reactant\nThe reactant that runs out first limits product amount.\n\n## Percent yield\n$$\\text{percent yield} = \\frac{\\text{actual}}{\\text{theoretical}} \\times 100\\%$$\n\n## Practice focus\n- Convert mass ↔ moles\n- Use mole ratios from balanced equations\n- Identify limiting vs excess reactant'
  ),
  (
    'AP Physics 1 - Kinematics',
    'Physics',
    'Motion graphs, free fall, and the big five equations.',
    E'# Kinematics\n\n## Key quantities\n- Displacement $x$\n- Velocity $v$\n- Acceleration $a$\n- Time $t$\n\n## Constant acceleration\n$$v = v_0 + at$$\n$$x = x_0 + v_0 t + \\frac{1}{2}at^2$$\n$$v^2 = v_0^2 + 2a(x-x_0)$$\n\n## Graphs\n- Slope of $x$-$t$ → velocity\n- Slope of $v$-$t$ → acceleration\n- Area under $v$-$t$ → displacement\n\n## Free fall\nNear Earth, $a \\approx -9.8\\,m/s^2$ (up positive convention optional).'
  ),
  (
    'AP Computer Science A - OOP Basics',
    'Computer Science',
    'Classes, objects, inheritance, and encapsulation for AP CSA.',
    E'# Object-Oriented Programming\n\n## Class vs object\nA class is a blueprint; an object is an instance.\n\n## Encapsulation\nHide internal state with private fields and public methods.\n\n## Inheritance\nA subclass extends a superclass and reuses behavior.\n\n## Polymorphism\nSame method name, different implementations (override).\n\n## AP CSA checklist\n- Constructors\n- Getters/setters\n- `this` vs `super`\n- ArrayList basics'
  ),
  (
    'AP World History - Trade Networks',
    'History',
    'Silk Roads, Indian Ocean, and Trans-Saharan exchange patterns.',
    E'# Global Trade Networks\n\n## Silk Roads\nLuxury goods, Buddhism/Islam spread, caravanserai, credit systems.\n\n## Indian Ocean\nMonsoon winds, bulk goods, diaspora communities, Swahili city-states.\n\n## Trans-Saharan\nGold-salt trade, camels, Mali/Songhai, Islam in West Africa.\n\n## Consequences\n- Cultural diffusion\n- Rise of merchant classes\n- Disease transmission (e.g. plague)\n- State wealth and patronage'
  ),
  (
    'AP Biology - Genetics & Mendel',
    'Biology',
    'Mendelian inheritance, Punnett squares, and DNA basics.',
    E'# Genetics\n\n## Mendel''s laws\n- Segregation\n- Independent assortment\n\n## Vocabulary\n- Allele, genotype, phenotype\n- Dominant vs recessive\n- Homozygous vs heterozygous\n\n## Punnett squares\nPredict genotype/phenotype ratios for monohybrid and dihybrid crosses.\n\n## Beyond Mendel\n- Incomplete dominance\n- Codominance\n- Sex-linked traits\n\n## DNA\nDouble helix; base pairs A-T and C-G; replication is semi-conservative.'
  ),
  (
    'AP Calculus AB - Integrals',
    'Math',
    'Antiderivatives, definite integrals, and FTC.',
    E'# Integrals\n\n## Antiderivative\n$F$ is an antiderivative of $f$ if $F''(x) = f(x)$.\n\n## Definite integral\n$$\\int_a^b f(x)\\,dx = \\lim_{n\\to\\infty}\\sum_{i=1}^{n} f(x_i^*)\\Delta x$$\n\n## Fundamental Theorem of Calculus\n1. $\\frac{d}{dx}\\int_a^x f(t)\\,dt = f(x)$\n2. $\\int_a^b f(x)\\,dx = F(b)-F(a)$\n\n## Applications\n- Net change\n- Area between curves\n- Average value of a function'
  ),
  (
    'Statistics - Descriptive Stats',
    'Statistics',
    'Mean, median, variance, and reading distributions.',
    E'# Descriptive Statistics\n\n## Center\n- Mean: sensitive to outliers\n- Median: resistant to outliers\n- Mode: most frequent value\n\n## Spread\n- Range\n- IQR = Q3 - Q1\n- Variance and standard deviation\n\n## Shape\n- Symmetric, skewed left/right\n- Unimodal vs multimodal\n\n## Outliers (1.5 IQR rule)\nBelow $Q1 - 1.5\\cdot IQR$ or above $Q3 + 1.5\\cdot IQR$.'
  ),
  (
    'Spanish - Present Tense Essentials',
    'Language',
    'Regular -ar/-er/-ir verbs and common irregulars.',
    E'# Present Tense\n\n## -ar endings\nyo: -o · tú: -as · él/ella: -a · nosotros: -amos · ellos: -an\n\n## -er endings\nyo: -o · tú: -es · él/ella: -e · nosotros: -emos · ellos: -en\n\n## -ir endings\nSimilar to -er except nosotros: -imos\n\n## High-frequency irregulars\nser, estar, ir, tener, hacer, poder, querer\n\n## Ser vs estar\nser: identity/characteristics · estar: location/temporary states'
  ),
  (
    'Psychology - Memory Systems',
    'Psychology',
    'Encoding, storage, retrieval, and forgetting for intro psych.',
    E'# Memory\n\n## Stages\n1. Encoding\n2. Storage\n3. Retrieval\n\n## Stores\n- Sensory memory (brief)\n- Short-term / working memory (~7±2)\n- Long-term memory\n\n## Types of LTM\n- Explicit (episodic, semantic)\n- Implicit (procedural, priming)\n\n## Forgetting\n- Decay\n- Interference (proactive/retroactive)\n- Retrieval failure\n\n## Study tips\nSpaced practice, retrieval practice, elaborative encoding.'
  ),
  (
    'Environmental Science - Carbon Cycle',
    'Environmental Science',
    'Reservoirs, fluxes, and human impacts on the carbon cycle.',
    E'# Carbon Cycle\n\n## Major reservoirs\nAtmosphere, oceans, biosphere, fossil fuels, sediments.\n\n## Key processes\n- Photosynthesis\n- Respiration\n- Combustion\n- Ocean absorption\n- Decomposition\n\n## Human impact\nFossil fuel burning and deforestation raise atmospheric $CO_2$.\n\n## Climate link\nGreenhouse effect intensifies as $CO_2$ and methane rise.\n\n## Mitigation levers\nRenewables, reforestation, efficiency, carbon capture.'
  )
) as v(title, subject, description, content)
where not exists (
  select 1 from public.library_items li where li.title = v.title
);

-- ---------------------------------------------------------------------------
-- 2) Share invites + comments
-- ---------------------------------------------------------------------------
create table if not exists public.share_invites (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'commenter' check (role in ('viewer', 'commenter')),
  token text not null unique,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists share_invites_study_id_idx on public.share_invites (study_id);
create index if not exists share_invites_email_idx on public.share_invites (lower(email));

create table if not exists public.share_comments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  invite_id uuid references public.share_invites (id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists share_comments_study_created_idx
  on public.share_comments (study_id, created_at desc);

alter table public.share_invites enable row level security;
alter table public.share_comments enable row level security;

drop policy if exists "Owners manage share invites" on public.share_invites;
create policy "Owners manage share invites"
  on public.share_invites for all
  using (
    exists (
      select 1 from public.studies s
      where s.id = study_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.studies s
      where s.id = study_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Invitees can read own invites" on public.share_invites;
create policy "Invitees can read own invites"
  on public.share_invites for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Owners read share comments" on public.share_comments;
create policy "Owners read share comments"
  on public.share_comments for select
  using (
    exists (
      select 1 from public.studies s
      where s.id = study_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Authors insert share comments" on public.share_comments;
create policy "Authors insert share comments"
  on public.share_comments for insert
  with check (
    auth.uid() is null
    or user_id = auth.uid()
    or exists (
      select 1 from public.studies s
      where s.id = study_id and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Progress / memory streaks
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists current_streak integer not null default 0;

alter table public.profiles
  add column if not exists longest_streak integer not null default 0;

alter table public.profiles
  add column if not exists last_study_date date;

create table if not exists public.study_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  cards_reviewed integer not null default 0,
  quizzes_taken integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, activity_date)
);

create index if not exists study_activity_user_date_idx
  on public.study_activity (user_id, activity_date desc);

alter table public.study_activity enable row level security;

drop policy if exists "Users manage own study activity" on public.study_activity;
create policy "Users manage own study activity"
  on public.study_activity for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
