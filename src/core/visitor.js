// Visitor context from the URL. ?for=ValueScale personalises billboards and the empty lot.
const raw = new URLSearchParams(location.search).get('for') || '';
export const VISITOR = { company: raw.replace(/[^\p{L}\p{N} &.\-]/gu, '').trim().slice(0, 28) || null };
