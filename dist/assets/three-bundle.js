
export const DoubleSide = 2;
export class Vector2 { constructor(x=0,y=0){this.x=x;this.y=y} set(x,y){this.x=x;this.y=y;return this} }
export class Vector4 { constructor(x=0,y=0,z=0,w=0){this.set(x,y,z,w)} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this} }
export class Scene { constructor(){this.children=[]} add(...o){this.children.push(...o)} }
export class Group extends Scene {}
export class OrthographicCamera { updateProjectionMatrix(){} }
export class WebGLRenderer { constructor({canvas}){this.canvas=canvas;this.gl=canvas.getContext('webgl2')||canvas.getContext('webgl');if(!this.gl)throw Error('WebGL unavailable')} setPixelRatio(r){this.r=r} setSize(w,h){this.canvas.width=Math.floor(w*(this.r||1));this.canvas.height=Math.floor(h*(this.r||1));this.canvas.style.width=w+'px';this.canvas.style.height=h+'px'} render(){const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0.01,0.03,0.08,1);gl.clear(gl.COLOR_BUFFER_BIT)} }
class Obj { constructor(){this.visible=true;this.position={set:(x,y,z)=>{this.x=x;this.y=y;this.z=z}};this.scale={set:(x,y,z)=>{this.sx=x;this.sy=y;this.sz=z}}} }
export class Mesh extends Obj { constructor(geometry,material){super();this.geometry=geometry;this.material=material} }
export class LineSegments extends Mesh {}
export class Points extends Mesh {}
export class PlaneGeometry { constructor(w,h){this.w=w;this.h=h} }
export class RingGeometry { constructor(a,b,c){this.a=a;this.b=b;this.c=c} }
export class CircleGeometry { constructor(r,s){this.r=r;this.s=s} }
export class BufferGeometry { constructor(){this.attributes={}} setAttribute(n,a){this.attributes[n]=a;return this} getAttribute(n){return this.attributes[n]} setDrawRange(s,c){this.drawStart=s;this.drawCount=c} }
export class BufferAttribute { constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.needsUpdate=false} setXYZ(i,x,y,z){const o=i*this.itemSize;this.array[o]=x;this.array[o+1]=y;this.array[o+2]=z} }
class Material { constructor(opts={}){Object.assign(this,opts);this.color={setHex:v=>{this.colorHex=v}}} clone(){return new this.constructor({...this})} }
export class ShaderMaterial extends Material {}
export class MeshBasicMaterial extends Material {}
export class LineBasicMaterial extends Material {}
export class PointsMaterial extends Material {}
