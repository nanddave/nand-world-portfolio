// Post-processing: bloom (night cities only) + tilt-shift (city mode, desktop). Off entirely on small screens.
import { THREE } from '../kit/kit.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';

export function createPost(renderer, enabled) {
  let composer = null, rp, bloom, th, tv;
  if (enabled) try {
    composer = new EffectComposer(renderer);
    rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()); composer.addPass(rp);
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .6, .5, .82); composer.addPass(bloom);
    th = new ShaderPass(HorizontalTiltShiftShader); tv = new ShaderPass(VerticalTiltShiftShader); composer.addPass(th); composer.addPass(tv);
    composer.addPass(new OutputPass());
  } catch (e) { composer = null; }
  return {
    active: !!composer,
    /** opts: { bloom: 0..1, tilt: bool } */
    render(scene, cam, opts = {}) {
      const b = opts.bloom || 0, t = !!opts.tilt;
      if (!composer || (!b && !t)) { renderer.render(scene, cam); return; }
      rp.scene = scene; rp.camera = cam; bloom.enabled = b > 0; bloom.strength = b; th.enabled = tv.enabled = t; composer.render();
    },
    resize(w, h) { if (!composer) return; composer.setSize(w, h); th.uniforms.h.value = 1.6 / w; tv.uniforms.v.value = 1.6 / h; th.uniforms.r.value = tv.uniforms.r.value = .52; },
  };
}
