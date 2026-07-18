import {LOGICAL_HEIGHT,LOGICAL_WIDTH} from '../config.js';

const EDGE_EPSILON=1e-7;

function positiveDimension(value){
  const number=Number(value);
  return Number.isFinite(number)&&number>0?number:1;
}

export function createViewport(viewWidth,viewHeight){
  const width=positiveDimension(viewWidth);
  const height=positiveDimension(viewHeight);
  const scale=Math.min(width/LOGICAL_WIDTH,height/LOGICAL_HEIGHT);
  const displayWidth=LOGICAL_WIDTH*scale;
  const displayHeight=LOGICAL_HEIGHT*scale;
  return {
    viewWidth:width,
    viewHeight:height,
    logicalWidth:LOGICAL_WIDTH,
    logicalHeight:LOGICAL_HEIGHT,
    scale,
    displayWidth,
    displayHeight,
    offsetX:(width-displayWidth)/2,
    offsetY:(height-displayHeight)/2
  };
}

export function clientToLogical(clientX,clientY,rect,viewport){
  if(!rect||!viewport||!Number.isFinite(viewport.scale)||viewport.scale<=0)return null;
  const localX=Number(clientX)-Number(rect.left||0);
  const localY=Number(clientY)-Number(rect.top||0);
  if(!Number.isFinite(localX)||!Number.isFinite(localY))return null;
  const minX=viewport.offsetX;
  const minY=viewport.offsetY;
  const maxX=minX+viewport.displayWidth;
  const maxY=minY+viewport.displayHeight;
  if(localX<minX-EDGE_EPSILON||localX>maxX+EDGE_EPSILON||localY<minY-EDGE_EPSILON||localY>maxY+EDGE_EPSILON)return null;
  const x=(localX-minX)/viewport.scale;
  const y=(localY-minY)/viewport.scale;
  return {
    x:Math.max(0,Math.min(LOGICAL_WIDTH,x)),
    y:Math.max(0,Math.min(LOGICAL_HEIGHT,y))
  };
}

export function logicalToClient(logicalX,logicalY,rect,viewport){
  return {
    x:Number(rect?.left||0)+viewport.offsetX+Number(logicalX)*viewport.scale,
    y:Number(rect?.top||0)+viewport.offsetY+Number(logicalY)*viewport.scale
  };
}
