// Ásia-Pacífico inteira (04-visao-de-arquitetura.md §4). FIPS é o código do State Dept.
export const PAISES = [
  { iso: 'CN', fips: 'CH', fcdo: 'china' },
  { iso: 'HK', fips: 'HK', fcdo: 'hong-kong' },
  { iso: 'MO', fips: 'MC', fcdo: 'macao' },
  { iso: 'TW', fips: 'TW', fcdo: 'taiwan' },
  { iso: 'JP', fips: 'JA', fcdo: 'japan' },
  { iso: 'KR', fips: 'KS', fcdo: 'south-korea' },
  { iso: 'PH', fips: 'RP', fcdo: 'philippines' },
  { iso: 'VN', fips: 'VM', fcdo: 'vietnam' },
  { iso: 'TH', fips: 'TH', fcdo: 'thailand' },
  { iso: 'MY', fips: 'MY', fcdo: 'malaysia' },
  { iso: 'SG', fips: 'SN', fcdo: 'singapore' },
  { iso: 'ID', fips: 'ID', fcdo: 'indonesia' },
  { iso: 'KH', fips: 'CB', fcdo: 'cambodia' },
  { iso: 'LA', fips: 'LA', fcdo: 'laos' },
  { iso: 'MM', fips: 'BM', fcdo: 'myanmar' },
  { iso: 'BN', fips: 'BX', fcdo: 'brunei' },
  { iso: 'TL', fips: 'TT', fcdo: 'timor-leste' },
  { iso: 'MN', fips: 'MG', fcdo: 'mongolia' },
  { iso: 'IN', fips: 'IN', fcdo: 'india' },
  { iso: 'AU', fips: 'AS', fcdo: 'australia' },
  { iso: 'NZ', fips: 'NZ', fcdo: 'new-zealand' },
  { iso: 'PG', fips: 'PP', fcdo: 'papua-new-guinea' },
] as const;

/** Caixa da Ásia-Pacífico para eventos naturais (lon 60..180, lat -50..55). */
export const CAIXA = { lonMin: 60, lonMax: 180, latMin: -50, latMax: 55 };
