const EPSILON=1e-7;

const clamp01=value=>Math.max(0,Math.min(1,value));
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;

function finiteSurfaceIntersection(originX,originY,targetX,targetY,surface){
  const rayX=targetX-originX;
  const rayY=targetY-originY;
  const surfaceX=surface.x2-surface.x1;
  const surfaceY=surface.y2-surface.y1;
  const denominator=cross(rayX,rayY,surfaceX,surfaceY);
  if(Math.abs(denominator)<=EPSILON)return null;

  const offsetX=surface.x1-originX;
  const offsetY=surface.y1-originY;
  const pathT=cross(offsetX,offsetY,surfaceX,surfaceY)/denominator;
  const segmentT=cross(offsetX,offsetY,rayX,rayY)/denominator;
  if(pathT<-EPSILON||pathT>1+EPSILON||segmentT<-EPSILON||segmentT>1+EPSILON)return null;

  const normalizedPathT=clamp01(pathT);
  return{
    surfaceKey:surface.surfaceKey,
    surfaceKind:surface.surfaceKind,
    x:originX+rayX*normalizedPathT,
    y:originY+rayY*normalizedPathT,
    pathT:normalizedPathT,
    segmentT:clamp01(segmentT)
  };
}

export function createReflectionPath({
  previous=null,
  surfaceKey,
  surfaceKind,
  x1,
  y1,
  x2,
  y2,
  parentOriginX,
  parentOriginY,
  childOriginX,
  childOriginY
}){
  const values=[x1,y1,x2,y2,parentOriginX,parentOriginY,childOriginX,childOriginY];
  if(!surfaceKey||values.some(value=>!Number.isFinite(value)))throw new TypeError('reflection path requires a finite surface and origins');
  if(Math.hypot(x2-x1,y2-y1)<=EPSILON)throw new TypeError('reflection path surface must have length');
  return Object.freeze({
    previous,
    surfaceKey,
    surfaceKind,
    x1,
    y1,
    x2,
    y2,
    parentOriginX,
    parentOriginY,
    childOriginX,
    childOriginY
  });
}

export function traceReflectionPath(originX,originY,targetX,targetY,path){
  if([originX,originY,targetX,targetY].some(value=>!Number.isFinite(value))){
    return{valid:false,intersections:[],reason:'non-finite-point'};
  }
  const intersections=[];
  const surfaces=new Set();
  let currentOriginX=originX;
  let currentOriginY=originY;
  let currentTargetX=targetX;
  let currentTargetY=targetY;
  let currentPath=path;

  while(currentPath){
    if(Math.hypot(
      currentOriginX-currentPath.childOriginX,
      currentOriginY-currentPath.childOriginY
    )>EPSILON){
      return{valid:false,intersections,reason:'path-origin-mismatch'};
    }
    if(surfaces.has(currentPath.surfaceKey)){
      return{valid:false,intersections,reason:'repeated-surface'};
    }
    surfaces.add(currentPath.surfaceKey);
    const intersection=finiteSurfaceIntersection(
      currentOriginX,
      currentOriginY,
      currentTargetX,
      currentTargetY,
      currentPath
    );
    if(!intersection){
      return{valid:false,intersections,reason:'outside-finite-surface'};
    }
    intersections.push(intersection);
    currentTargetX=intersection.x;
    currentTargetY=intersection.y;
    currentOriginX=currentPath.parentOriginX;
    currentOriginY=currentPath.parentOriginY;
    currentPath=currentPath.previous;
  }

  return{valid:true,intersections,reason:null};
}

export function reflectionPathReaches(originX,originY,targetX,targetY,path){
  return traceReflectionPath(originX,originY,targetX,targetY,path).valid;
}
