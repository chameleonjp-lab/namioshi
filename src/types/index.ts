export type State='HOME'|'LOADING'|'READY'|'PLAYING'|'RESULT'|'ERROR';
export type Quality='HIGH'|'MID'|'LOW';
export type Wave={id:number;originX:number;originY:number;radius:number;width:number;speed:number;age:number;life:number;reflections:number;kind:'direct'|'wall'|'glass';hit:Set<number>;edges:Set<string>;glass:Set<number>};
export type Beacon={id:number;x:number;y:number;baseX:number;baseY:number;vx:number;vy:number;radius:number;flash:number};
export type Glass={id:number;x1:number;y1:number;x2:number;y2:number;nx:number;ny:number};
export type Particle={x:number;y:number;vx:number;vy:number;age:number;life:number};
