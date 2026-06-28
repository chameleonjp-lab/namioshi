import * as THREE from 'three';
import { QUALITY } from '../config.js';
import { fragmentShader, vertexShader } from './shaders/water.js';
const MAX_WAVES = 24, MAX_BEACONS = 3, MAX_GLASS = 8, MAX_PARTICLES = 90;
export class WebGLView {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera();
        this.group = new THREE.Group();
        this.rings = [];
        this.beacons = [];
        this.ringGeo = new THREE.RingGeometry(1, 2, 64);
        this.ringMat = new THREE.MeshBasicMaterial({ color: 0x58e8ff, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false });
        this.beaconGeo = new THREE.CircleGeometry(1, 32);
        this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffe8, transparent: true, opacity: .95, depthWrite: false });
        this.glassMat = new THREE.LineBasicMaterial({ color: 0xbff7ff, transparent: true, opacity: .35 });
        this.particleMat = new THREE.PointsMaterial({ color: 0xb9fbff, transparent: true, opacity: .9, size: 3, sizeAttenuation: false, depthWrite: false });
        this.lastGlassKey = '';
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        this.mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(1, 1) }, uWaveCount: { value: 0 }, uWaves: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) } } });
        this.bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
        this.scene.add(this.bg);
        this.scene.add(this.group);
        for (let i = 0; i < MAX_WAVES; i++) {
            const m = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
            m.visible = false;
            this.rings.push(m);
            this.group.add(m);
        }
        for (let i = 0; i < MAX_BEACONS; i++) {
            const m = new THREE.Mesh(this.beaconGeo, this.beaconMat.clone());
            m.visible = false;
            this.beacons.push(m);
            this.group.add(m);
        }
        this.glass = new THREE.LineSegments(new THREE.BufferGeometry(), this.glassMat);
        this.group.add(this.glass);
        const pos = new Float32Array(MAX_PARTICLES * 3);
        const alpha = new Float32Array(MAX_PARTICLES);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
        geo.setDrawRange(0, 0);
        this.particles = new THREE.Points(geo, this.particleMat);
        this.group.add(this.particles);
    }
    resize(w, h, q) { this.renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY[q].dpr)); this.renderer.setSize(w, h, false); this.camera.left = 0; this.camera.right = w; this.camera.top = 0; this.camera.bottom = h; this.camera.near = -10; this.camera.far = 10; this.camera.updateProjectionMatrix(); this.bg.scale.set(w, h, 1); this.bg.position.set(w / 2, h / 2, 0); this.mat.uniforms.uResolution.value.set(w, h); }
    updateGlass(world) { const key = world.glass.map(g => `${g.id}:${g.x1.toFixed(1)},${g.y1.toFixed(1)},${g.x2.toFixed(1)},${g.y2.toFixed(1)}`).join('|'); if (key === this.lastGlassKey)
        return; this.lastGlassKey = key; const data = new Float32Array(MAX_GLASS * 2 * 3); world.glass.slice(0, MAX_GLASS).forEach((g, i) => { const o = i * 6; data.set([g.x1, g.y1, 0, g.x2, g.y2, 0], o); }); this.glass.geometry.setAttribute('position', new THREE.BufferAttribute(data, 3)); this.glass.geometry.setDrawRange(0, Math.min(world.glass.length, MAX_GLASS) * 2); this.glass.geometry.attributes.position.needsUpdate = true; }
    render(world, t, q) { this.mat.uniforms.uTime.value = t * .001; const waves = world.waves.slice(0, QUALITY[q].waves); this.mat.uniforms.uWaveCount.value = Math.min(12, waves.length); waves.slice(0, 12).forEach((w, i) => this.mat.uniforms.uWaves.value[i].set(w.originX, w.originY, w.radius, w.width)); this.updateGlass(world); this.rings.forEach((m, i) => { const w = world.waves[i]; m.visible = !!w; if (!w)
        return; const radius = Math.max(1, w.radius), thick = Math.max(1, w.width); m.position.set(w.originX, w.originY, 0); m.scale.set(radius + thick, radius + thick, 1); const mat = m.material; mat.color.setHex(w.kind === 'glass' ? 0xb7f6ff : 0x58e8ff); mat.opacity = Math.max(0, 1 - w.age / w.life) * .45; }); this.beacons.forEach((m, i) => { const b = world.beacons[i]; m.visible = !!b; if (!b)
        return; m.position.set(b.x, b.y, 0); m.scale.set(b.radius * (1 + b.flash * .45), b.radius * (1 + b.flash * .45), 1); m.material.opacity = .75 + b.flash * .2; }); const pos = this.particles.geometry.getAttribute('position'); let count = 0; for (const p of world.particles.slice(0, MAX_PARTICLES)) {
        pos.setXYZ(count++, p.x, p.y, 0);
    } pos.needsUpdate = true; this.particles.geometry.setDrawRange(0, count); this.renderer.render(this.scene, this.camera); }
}
