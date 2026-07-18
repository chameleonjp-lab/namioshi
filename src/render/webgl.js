import {LOGICAL_HEIGHT,LOGICAL_WIDTH,QUALITY} from '../config.js';
import {createViewport} from '../game/viewport.js';

const MAX_WAVES=12;
const MAX_PARTICLES=90;
const SEGMENTS=96;

function shader(gl,type,source){
  const value=gl.createShader(type);
  if(!value)throw Error('WebGL shader unavailable');
  gl.shaderSource(value,source);
  gl.compileShader(value);
  if(!gl.getShaderParameter(value,gl.COMPILE_STATUS))throw Error('WebGL shader compile failed: '+gl.getShaderInfoLog(value));
  return value;
}

function program(gl,vertexSource,fragmentSource){
  const value=gl.createProgram();
  if(!value)throw Error('WebGL program unavailable');
  gl.attachShader(value,shader(gl,gl.VERTEX_SHADER,vertexSource));
  gl.attachShader(value,shader(gl,gl.FRAGMENT_SHADER,fragmentSource));
  gl.linkProgram(value);
  if(!gl.getProgramParameter(value,gl.LINK_STATUS))throw Error('WebGL program link failed: '+gl.getProgramInfoLog(value));
  return value;
}

function attributeLocation(gl,value,name){
  const location=gl.getAttribLocation(value,name);
  if(location<0)throw Error('WebGL attribute missing: '+name);
  return location;
}

const vertex2d='attribute vec2 a;uniform vec2 uRes;void main(){vec2 p=a/uRes*2.0-1.0;gl_Position=vec4(p.x,-p.y,0,1);}';
const backgroundVertex='attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0,1);}';
const backgroundFragment='precision mediump float;varying vec2 v;uniform float uTime;uniform vec2 uRes;uniform int uWaveCount;uniform vec4 uWaves[12];void main(){vec2 p=v*uRes;float w=0.0;for(int i=0;i<12;i++){if(i>=uWaveCount)break;vec4 a=uWaves[i];float d=distance(p,a.xy);w+=exp(-pow(abs(d-a.z)/(a.w+1.0),2.0))*.26;}float rip=sin(p.x*.045+uTime*1.4)*.025+sin(p.y*.055-uTime*1.1)*.018;vec3 col=mix(vec3(.006,.025,.055),vec3(.02,.16,.24),v.y+rip+w);col+=vec3(.06,.55,.75)*w;gl_FragColor=vec4(col,1.0);}';
const colorFragment='precision mediump float;uniform vec4 uColor;void main(){gl_FragColor=uColor;}';
const pointVertex='attribute vec2 a;uniform vec2 uRes;uniform float uSize;void main(){vec2 p=a/uRes*2.0-1.0;gl_Position=vec4(p.x,-p.y,0,1);gl_PointSize=uSize;}';

export class WebGLView{
  w=LOGICAL_WIDTH;
  h=LOGICAL_HEIGHT;
  screenWidth=1;
  screenHeight=1;
  dpr=1;
  viewport=createViewport(1,1);
  ring=new Float32Array((SEGMENTS+1)*2);
  circle=new Float32Array((SEGMENTS+2)*2);
  tmp=new Float32Array(1024);
  quad=new Float32Array([-1,-1,1,-1,-1,1,1,1]);
  waveData=new Float32Array(MAX_WAVES*4);

  constructor(canvas){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl',{alpha:false});
    if(!gl)throw Error('WebGL unavailable');
    this.gl=gl;
    this.bg=program(gl,backgroundVertex,backgroundFragment);
    this.color=program(gl,vertex2d,colorFragment);
    this.point=program(gl,pointVertex,colorFragment);
    const buffer=gl.createBuffer();
    if(!buffer)throw Error('WebGL buffer unavailable');
    this.buf=buffer;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    this.selfTest();
  }

  selfTest(){
    const gl=this.gl;
    gl.useProgram(this.color);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0]),gl.DYNAMIC_DRAW);
    const attribute=attributeLocation(gl,this.color,'a');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    gl.uniform2f(gl.getUniformLocation(this.color,'uRes'),1,1);
    gl.uniform4f(gl.getUniformLocation(this.color,'uColor'),0,0,0,0);
    gl.drawArrays(gl.LINES,0,2);
    const error=gl.getError();
    if(error!==gl.NO_ERROR)throw Error('WebGL draw unavailable: '+error);
  }

  resize(width,height,quality,viewport=createViewport(width,height)){
    this.screenWidth=width;
    this.screenHeight=height;
    this.viewport=viewport;
    this.dpr=Math.min(devicePixelRatio||1,QUALITY[quality].dpr);
    this.canvas.width=Math.max(1,Math.floor(width*this.dpr));
    this.canvas.height=Math.max(1,Math.floor(height*this.dpr));
    this.canvas.style.width=width+'px';
    this.canvas.style.height=height+'px';
  }

  useFullViewport(){
    this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
  }

  useGameViewport(){
    const viewport=this.viewport;
    const x=Math.max(0,Math.round(viewport.offsetX*this.dpr));
    const y=Math.max(0,Math.round((viewport.viewHeight-viewport.offsetY-viewport.displayHeight)*this.dpr));
    const width=Math.max(1,Math.min(this.canvas.width-x,Math.round(viewport.displayWidth*this.dpr)));
    const height=Math.max(1,Math.min(this.canvas.height-y,Math.round(viewport.displayHeight*this.dpr)));
    this.gl.viewport(x,y,width,height);
  }

  setCommon(value){
    const gl=this.gl;
    gl.useProgram(value);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);
    const attribute=attributeLocation(gl,value,'a');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    gl.uniform2f(gl.getUniformLocation(value,'uRes'),LOGICAL_WIDTH,LOGICAL_HEIGHT);
  }

  drawBackground(time,waves,quality,resolutionWidth,resolutionHeight){
    const gl=this.gl;
    gl.useProgram(this.bg);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);
    gl.bufferData(gl.ARRAY_BUFFER,this.quad,gl.STATIC_DRAW);
    const attribute=attributeLocation(gl,this.bg,'a');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(this.bg,'uTime'),time*.001);
    gl.uniform2f(gl.getUniformLocation(this.bg,'uRes'),resolutionWidth,resolutionHeight);
    const visible=waves.slice(0,Math.min(MAX_WAVES,QUALITY[quality].waves));
    this.waveData.fill(0);
    visible.forEach((wave,index)=>this.waveData.set([wave.originX,wave.originY,wave.radius,wave.width],index*4));
    gl.uniform1i(gl.getUniformLocation(this.bg,'uWaveCount'),visible.length);
    gl.uniform4fv(gl.getUniformLocation(this.bg,'uWaves[0]'),this.waveData);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  drawLine(points,count,rgba,mode,lineWidth=1){
    const gl=this.gl;
    this.setCommon(this.color);
    gl.bufferData(gl.ARRAY_BUFFER,points.subarray(0,count*2),gl.DYNAMIC_DRAW);
    gl.uniform4f(gl.getUniformLocation(this.color,'uColor'),rgba[0],rgba[1],rgba[2],rgba[3]);
    gl.lineWidth(Math.max(1,lineWidth*this.dpr*this.viewport.scale));
    gl.drawArrays(mode,0,count);
  }

  render(world,time,quality){
    const gl=this.gl;
    this.useFullViewport();
    gl.clearColor(.006,.025,.055,1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.drawBackground(time,[],quality,this.screenWidth,this.screenHeight);

    this.useGameViewport();
    this.drawBackground(time,world.waves,quality,world.w,world.h);

    for(const glass of world.glass){
      this.tmp.set([glass.x1,glass.y1,glass.x2,glass.y2]);
      this.drawLine(this.tmp,2,[.78,1,1,.48],gl.LINES,3);
    }
    for(const wave of world.waves.slice(0,QUALITY[quality].waves)){
      for(let i=0;i<=SEGMENTS;i++){
        const angle=i/SEGMENTS*Math.PI*2;
        const offset=i*2;
        this.ring[offset]=wave.originX+Math.cos(angle)*wave.radius;
        this.ring[offset+1]=wave.originY+Math.sin(angle)*wave.radius;
      }
      const fade=Math.max(0,1-wave.age/wave.life);
      this.drawLine(this.ring,SEGMENTS+1,wave.kind==='glass'?[.72,.96,1,fade*.78]:[.35,.92,1,fade*.82],gl.LINE_STRIP,2);
    }
    for(const beacon of world.beacons){
      this.circle[0]=beacon.x;
      this.circle[1]=beacon.y;
      const glowRadius=beacon.radius*(2.6+beacon.flash*.9);
      for(let i=0;i<=SEGMENTS;i++){
        const angle=i/SEGMENTS*Math.PI*2;
        const offset=(i+1)*2;
        this.circle[offset]=beacon.x+Math.cos(angle)*glowRadius;
        this.circle[offset+1]=beacon.y+Math.sin(angle)*glowRadius;
      }
      this.drawLine(this.circle,SEGMENTS+2,[.35,.9,1,.20+beacon.flash*.25],gl.TRIANGLE_FAN);
      for(let i=0;i<=SEGMENTS;i++){
        const angle=i/SEGMENTS*Math.PI*2;
        const offset=i*2;
        this.ring[offset]=beacon.x+Math.cos(angle)*beacon.radius;
        this.ring[offset+1]=beacon.y+Math.sin(angle)*beacon.radius;
      }
      this.drawLine(this.ring,SEGMENTS+1,[1,1,.88,.95],gl.TRIANGLE_FAN);
    }
    let count=0;
    for(const particle of world.particles.slice(0,MAX_PARTICLES)){
      this.tmp[count++]=particle.x;
      this.tmp[count++]=particle.y;
    }
    if(count){
      this.setCommon(this.point);
      gl.bufferData(gl.ARRAY_BUFFER,this.tmp.subarray(0,count),gl.DYNAMIC_DRAW);
      gl.uniform4f(gl.getUniformLocation(this.point,'uColor'),.75,1,1,.9);
      gl.uniform1f(gl.getUniformLocation(this.point,'uSize'),Math.max(2,3*this.dpr*this.viewport.scale));
      gl.drawArrays(gl.POINTS,0,count/2);
    }
  }
}
