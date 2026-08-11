import {LOGICAL_HEIGHT,LOGICAL_WIDTH,QUALITY} from '../config.js';
import {createViewport} from '../game/viewport.js';
import {fillReflectionArcPoints,REFLECTION_ARC_SEGMENTS} from './reflection-arcs.js';

const MAX_BACKGROUND_WAVES=12;
const MAX_PARTICLES=90;
const MAX_DYNAMIC_FLOATS=1024;
const SEGMENTS=96;
const UNIT_CIRCLE_COS=new Float32Array(SEGMENTS+1);
const UNIT_CIRCLE_SIN=new Float32Array(SEGMENTS+1);
for(let index=0;index<=SEGMENTS;index++){
  const angle=index/SEGMENTS*Math.PI*2;
  UNIT_CIRCLE_COS[index]=Math.cos(angle);
  UNIT_CIRCLE_SIN[index]=Math.sin(angle);
}

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

function uniformLocation(gl,value,name){
  const location=gl.getUniformLocation(value,name);
  if(location===null)throw Error('WebGL uniform missing: '+name);
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
  arcPoints=new Float32Array(REFLECTION_ARC_SEGMENTS*4);
  tmp=new Float32Array(MAX_DYNAMIC_FLOATS);
  quad=new Float32Array([-1,-1,1,-1,-1,1,1,1]);
  waveData=new Float32Array(MAX_BACKGROUND_WAVES*4);
  selfTestPoints=new Float32Array([0,0,1,0]);
  rgba=new Float32Array(4);
  backgroundBuffer=null;
  programInfo=null;
  activeProgram=null;
  activeBuffer=null;

  waveColor(wave,fade){
    if(wave.reflections>=2){
      this.rgba[0]=1; this.rgba[1]=.78; this.rgba[2]=.25; this.rgba[3]=fade*.9;
    }else if(wave.kind==='glass'){
      this.rgba[0]=.76; this.rgba[1]=.52; this.rgba[2]=1; this.rgba[3]=fade*.86;
    }else if(wave.kind==='wall'){
      this.rgba[0]=.46; this.rgba[1]=.58; this.rgba[2]=1; this.rgba[3]=fade*.82;
    }else{
      this.rgba[0]=.35; this.rgba[1]=.92; this.rgba[2]=1; this.rgba[3]=fade*.82;
    }
    return this.rgba;
  }

  constructor(canvas){
    this.canvas=canvas;
    this.initializeContext();
  }

  initializeContext(){
    const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'})||this.canvas.getContext('experimental-webgl',{alpha:false});
    if(!gl)throw Error('WebGL unavailable');
    const background=program(gl,backgroundVertex,backgroundFragment);
    const color=program(gl,vertex2d,colorFragment);
    const point=program(gl,pointVertex,colorFragment);
    const backgroundBuffer=gl.createBuffer();
    const dynamicBuffer=gl.createBuffer();
    if(!backgroundBuffer||!dynamicBuffer)throw Error('WebGL buffer unavailable');
    this.gl=gl;
    this.bg=background;
    this.color=color;
    this.point=point;
    this.buf=dynamicBuffer;
    this.backgroundBuffer=backgroundBuffer;
    this.programInfo={
      bg:{
        program:background,
        attribute:attributeLocation(gl,background,'a'),
        uniforms:{
          time:uniformLocation(gl,background,'uTime'),
          resolution:uniformLocation(gl,background,'uRes'),
          waveCount:uniformLocation(gl,background,'uWaveCount'),
          waves:uniformLocation(gl,background,'uWaves[0]')
        }
      },
      color:{
        program:color,
        attribute:attributeLocation(gl,color,'a'),
        uniforms:{
          color:uniformLocation(gl,color,'uColor'),
          resolution:uniformLocation(gl,color,'uRes')
        }
      },
      point:{
        program:point,
        attribute:attributeLocation(gl,point,'a'),
        uniforms:{
          color:uniformLocation(gl,point,'uColor'),
          resolution:uniformLocation(gl,point,'uRes'),
          size:uniformLocation(gl,point,'uSize')
        }
      }
    };
    this.activeProgram=null;
    this.activeBuffer=null;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.bindBuffer(gl.ARRAY_BUFFER,backgroundBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,this.quad,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,MAX_DYNAMIC_FLOATS*Float32Array.BYTES_PER_ELEMENT,gl.DYNAMIC_DRAW);
    gl.useProgram(color);
    gl.uniform2f(this.programInfo.color.uniforms.resolution,LOGICAL_WIDTH,LOGICAL_HEIGHT);
    gl.useProgram(point);
    gl.uniform2f(this.programInfo.point.uniforms.resolution,LOGICAL_WIDTH,LOGICAL_HEIGHT);
    this.selfTest();
  }

  restore(){
    this.initializeContext();
  }

  selfTest(){
    const gl=this.gl;
    const info=this.programInfo.color;
    this.setCommon(info);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,this.selfTestPoints);
    gl.uniform4f(info.uniforms.color,0,0,0,0);
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
    this.activeProgram=null;
    this.activeBuffer=null;
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

  activate(info,buffer){
    const gl=this.gl;
    const programChanged=this.activeProgram!==info.program;
    const bufferChanged=this.activeBuffer!==buffer;
    if(programChanged){
      gl.useProgram(info.program);
      this.activeProgram=info.program;
    }
    if(bufferChanged){
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      this.activeBuffer=buffer;
    }
    if(programChanged||bufferChanged){
      gl.enableVertexAttribArray(info.attribute);
      gl.vertexAttribPointer(info.attribute,2,gl.FLOAT,false,0,0);
    }
  }

  setCommon(info){
    this.activate(info,this.buf);
  }

  drawBackground(time,waves,quality,resolutionWidth,resolutionHeight){
    const gl=this.gl;
    const info=this.programInfo.bg;
    this.activate(info,this.backgroundBuffer);
    gl.uniform1f(info.uniforms.time,time*.001);
    gl.uniform2f(info.uniforms.resolution,resolutionWidth,resolutionHeight);
    const visibleCount=Math.min(MAX_BACKGROUND_WAVES,QUALITY[quality].waves,waves.length);
    this.waveData.fill(0);
    for(let index=0;index<visibleCount;index++){
      const wave=waves[index];
      const offset=index*4;
      this.waveData[offset]=wave.originX;
      this.waveData[offset+1]=wave.originY;
      this.waveData[offset+2]=wave.radius;
      this.waveData[offset+3]=wave.width;
    }
    gl.uniform1i(info.uniforms.waveCount,visibleCount);
    gl.uniform4fv(info.uniforms.waves,this.waveData);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  drawLine(points,count,mode,lineWidth,red,green,blue,alpha){
    const gl=this.gl;
    const info=this.programInfo.color;
    this.setCommon(info);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,points);
    gl.uniform4f(info.uniforms.color,red,green,blue,alpha);
    gl.lineWidth(Math.max(1,lineWidth*this.dpr*this.viewport.scale));
    gl.drawArrays(mode,0,count);
  }

  drawWave(points,count,mode,lineWidth,wave,fade){
    const color=this.waveColor(wave,fade);
    this.drawLine(points,count,mode,lineWidth,color[0],color[1],color[2],color[3]);
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
      this.tmp[0]=glass.x1;
      this.tmp[1]=glass.y1;
      this.tmp[2]=glass.x2;
      this.tmp[3]=glass.y2;
      this.drawLine(this.tmp,2,gl.LINES,8,.42,.24,1,.20);
      this.drawLine(this.tmp,2,gl.LINES,3,.78,.68,1,.92);
      const midX=(glass.x1+glass.x2)*.5;
      const midY=(glass.y1+glass.y2)*.5;
      this.tmp[0]=glass.x1-4; this.tmp[1]=glass.y1-4;
      this.tmp[2]=glass.x1+4; this.tmp[3]=glass.y1+4;
      this.tmp[4]=glass.x1-4; this.tmp[5]=glass.y1+4;
      this.tmp[6]=glass.x1+4; this.tmp[7]=glass.y1-4;
      this.tmp[8]=glass.x2-4; this.tmp[9]=glass.y2-4;
      this.tmp[10]=glass.x2+4; this.tmp[11]=glass.y2+4;
      this.tmp[12]=glass.x2-4; this.tmp[13]=glass.y2+4;
      this.tmp[14]=glass.x2+4; this.tmp[15]=glass.y2-4;
      this.drawLine(this.tmp,8,gl.LINES,1.5,.88,.82,1,.78);
      this.tmp[0]=midX-glass.nx*10;
      this.tmp[1]=midY-glass.ny*10;
      this.tmp[2]=midX+glass.nx*10;
      this.tmp[3]=midY+glass.ny*10;
      this.drawLine(this.tmp,2,gl.LINES,2,1,.86,.4,.9);
    }
    for(const effect of world.reflectionEffects){
      const progress=Math.min(1,effect.age/effect.life);
      const radius=4+progress*22;
      this.circle[0]=effect.x;
      this.circle[1]=effect.y;
      for(let i=0;i<=SEGMENTS;i++){
        const offset=(i+1)*2;
        this.circle[offset]=effect.x+UNIT_CIRCLE_COS[i]*radius;
        this.circle[offset+1]=effect.y+UNIT_CIRCLE_SIN[i]*radius;
      }
      const alpha=(1-progress)*.72;
      if(effect.kind==='glass')this.drawLine(this.circle,SEGMENTS+2,gl.LINE_STRIP,2,.84,.56,1,alpha);
      else this.drawLine(this.circle,SEGMENTS+2,gl.LINE_STRIP,2,.5,.7,1,alpha);
      this.tmp[0]=effect.x;
      this.tmp[1]=effect.y;
      this.tmp[2]=effect.x+effect.normalX*(12+progress*18);
      this.tmp[3]=effect.y+effect.normalY*(12+progress*18);
      this.drawLine(this.tmp,2,gl.LINES,2,1,.86,.4,alpha);
    }
    for(const wave of world.waves){
      const fade=Math.max(0,1-wave.age/wave.life);
      if((wave.reflectionDepth??wave.reflections??0)>0){
        const pointCount=fillReflectionArcPoints(wave,this.arcPoints,REFLECTION_ARC_SEGMENTS);
        if(pointCount>0)this.drawWave(this.arcPoints,pointCount/2,gl.LINES,wave.reflections>=2?3:2,wave,fade);
        continue;
      }
      for(let i=0;i<=SEGMENTS;i++){
        const offset=i*2;
        this.ring[offset]=wave.originX+UNIT_CIRCLE_COS[i]*wave.radius;
        this.ring[offset+1]=wave.originY+UNIT_CIRCLE_SIN[i]*wave.radius;
      }
      this.drawWave(this.ring,SEGMENTS+1,gl.LINE_STRIP,wave.reflections>=2?3:2,wave,fade);
    }
    for(const beacon of world.beacons){
      this.circle[0]=beacon.x;
      this.circle[1]=beacon.y;
      const glowRadius=beacon.radius*(2.6+beacon.flash*.9);
      for(let i=0;i<=SEGMENTS;i++){
        const offset=(i+1)*2;
        this.circle[offset]=beacon.x+UNIT_CIRCLE_COS[i]*glowRadius;
        this.circle[offset+1]=beacon.y+UNIT_CIRCLE_SIN[i]*glowRadius;
      }
      this.drawLine(this.circle,SEGMENTS+2,gl.TRIANGLE_FAN,1,.35,.9,1,.20+beacon.flash*.25);
      for(let i=0;i<=SEGMENTS;i++){
        const offset=i*2;
        this.ring[offset]=beacon.x+UNIT_CIRCLE_COS[i]*beacon.radius;
        this.ring[offset+1]=beacon.y+UNIT_CIRCLE_SIN[i]*beacon.radius;
      }
      this.drawLine(this.ring,SEGMENTS+1,gl.TRIANGLE_FAN,1,1,1,.88,.95);
    }
    let count=0;
    const particleCount=Math.min(MAX_PARTICLES,QUALITY[quality].particles,world.particles.length);
    for(let index=0;index<particleCount;index++){
      const particle=world.particles[index];
      this.tmp[count++]=particle.x;
      this.tmp[count++]=particle.y;
    }
    if(count){
      const info=this.programInfo.point;
      this.setCommon(info);
      gl.bufferSubData(gl.ARRAY_BUFFER,0,this.tmp);
      gl.uniform4f(info.uniforms.color,.75,1,1,.9);
      gl.uniform1f(info.uniforms.size,Math.max(2,3*this.dpr*this.viewport.scale));
      gl.drawArrays(gl.POINTS,0,count/2);
    }
  }
}
