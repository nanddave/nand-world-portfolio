// STUB — to be replaced by the missions agent.
export function mount(el, ctx) { el.innerHTML = '<p>Mission "jarvis" coming soon.</p>'; ctx.work.step('Stub mounted', 'jarvis'); return { unmount() { el.innerHTML = ''; } }; }
