export const FIXED_STEP_SECONDS=1/60;
export const MAX_FIXED_STEPS_PER_FRAME=3;
export const MAX_ACCUMULATED_SECONDS=.05;

const EPSILON=1e-9;

export class FixedStepRunner{
  accumulator=0;
  lastTimestamp=null;

  reset(timestamp=null){
    this.accumulator=0;
    this.lastTimestamp=Number.isFinite(timestamp)?timestamp:null;
  }

  suspend(){
    this.reset();
  }

  resume(timestamp){
    this.reset(timestamp);
  }

  advance(timestamp,update){
    if(typeof update!=='function')throw new TypeError('fixed-step update must be a function');
    if(!Number.isFinite(timestamp))return 0;
    if(this.lastTimestamp===null){
      this.lastTimestamp=timestamp;
      return 0;
    }

    const elapsed=Math.max(0,(timestamp-this.lastTimestamp)/1000);
    this.lastTimestamp=timestamp;
    this.accumulator=Math.min(MAX_ACCUMULATED_SECONDS,this.accumulator+elapsed);

    let steps=0;
    while(this.accumulator+EPSILON>=FIXED_STEP_SECONDS&&steps<MAX_FIXED_STEPS_PER_FRAME){
      this.accumulator=Math.max(0,this.accumulator-FIXED_STEP_SECONDS);
      update(FIXED_STEP_SECONDS);
      steps++;
    }

    if(steps===MAX_FIXED_STEPS_PER_FRAME&&this.accumulator+EPSILON>=FIXED_STEP_SECONDS)this.accumulator=0;
    return steps;
  }
}

export function createPlayDeadline(startTimestamp,durationSeconds){
  if(!Number.isFinite(startTimestamp)||!Number.isFinite(durationSeconds)||durationSeconds<0){
    throw new TypeError('play deadline requires finite start and duration');
  }
  return startTimestamp+durationSeconds*1000;
}

export function remainingPlaySeconds(deadline,timestamp){
  if(!Number.isFinite(deadline)||!Number.isFinite(timestamp))return Number.POSITIVE_INFINITY;
  return Math.max(0,(deadline-timestamp)/1000);
}

export function shouldFinishPlay(remainingTime){
  return remainingTime<=0;
}
