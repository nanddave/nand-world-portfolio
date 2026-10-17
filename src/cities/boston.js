// STUB — to be replaced by the city agent.
import { newCity } from '../kit/city.js';
import { box } from '../kit/kit.js';
export function build() { const C = newCity({ top: '#6CA6DE', hor: '#FFE0AE', bot: '#C9A26E', fog: '#EED9B8', sun: '#FFE4B8', si: 1.3, sunPos: [60, 38, 40], hs: '#D6E4F5', hg: '#8A6A44', hi: .7, ground: '#C6A46A' }); C.add(box(10, 10, 10, '#E0A84A')); C.spot(0, 12, 0); return C; }
