// City registry. Each module exports build() -> newCity(...) result (see src/kit/city.js).
export const CITY_BUILDERS = {
  nadiad: () => import('./nadiad.js'),
  blr: () => import('./blr.js'),
  boston: () => import('./boston.js'),
  irving: () => import('./irving.js'),
  seattle: () => import('./seattle.js'),
  sf: () => import('./sf.js'),
  brokai: () => import('./brokai.js'),
};
export async function buildCity(id) { const m = await CITY_BUILDERS[id](); return m.build(); }
