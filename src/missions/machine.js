// STUB — to be replaced by the missions agent.
export function mount(el, ctx) { el.innerHTML = '<p>Mission "machine" coming soon.</p>'; ctx.work.step('Stub mounted', 'machine'); return { unmount() { el.innerHTML = ''; } }; }
