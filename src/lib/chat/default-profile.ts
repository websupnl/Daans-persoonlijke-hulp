export interface DefaultProfileFact {
  key: string
  value: string
  tags: string[]
}

export const DEFAULT_PROFILE_FACTS: DefaultProfileFact[] = [
  {
    key: 'naam',
    value: 'Je bent Daan Koolhaas.',
    tags: ['daan', 'ik', 'wie ben ik', 'profiel'],
  },
  {
    key: 'locatie',
    value: 'Je bent gebaseerd in Friesland, Nederland.',
    tags: ['friesland', 'nederland', 'locatie', 'over mij'],
  },
  {
    key: 'websup',
    value: 'Je bent oprichter van WebsUp.nl en bouwt websites, webshops, automations en digitale oplossingen.',
    tags: ['websup', 'bedrijf', 'bedrijven', 'werk', 'ondernemen'],
  },
  {
    key: 'bouma',
    value: 'Je werkt daarnaast vier dagen per week bij Bouma Technisch Installatiebedrijf en doet daar technisch werk plus offertes en calculaties.',
    tags: ['bouma', 'werk', 'installatie', 'elektra'],
  },
  {
    key: 'rol',
    value: 'Je gebruikt deze app als persoonlijk assistent-systeem en tweede brein voor werk, privé, projecten en ideeën.',
    tags: ['app', 'assistent', 'tweede brein', 'over mij'],
  },
  {
    key: 'bedrijven',
    value: 'Je focus ligt op WebsUp.nl, Thuisbatterijen Friesland in opbouw en op termijn Koolhaas Installaties.',
    tags: ['bedrijven', 'websup', 'thuisbatterijen', 'koolhaas installaties'],
  },
]
