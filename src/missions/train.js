// STUB — to be replaced by the missions agent.
export function mount(el, ctx) { el.innerHTML = '<p>Mission "train" coming soon.</p>'; ctx.work.step('Stub mounted', 'train'); return { unmount() { el.innerHTML = ''; } }; }
