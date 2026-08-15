export const FIXED_STEP_SECONDS=1/60;
export const MAX_FIXED_STEPS_PER_FRAME=3;
// A render frame is deliberately limited to three updates, but elapsed time
// must remain queued for later frames.  Capping this accumulator would make a
// long frame permanently change the simulation result.
export const MAX_ACCUMULATED_SECONDS=Number.POSITIVE_INFINITY;

const EPSILON=1e-9;
const BOUNDARY_EPSILON_MS=1e-6;

/**
 * Input captured by the UI is applied at a fixed simulation boundary rather
 * than when the browser happens to dispatch the event.  Keeping the clock
 * timestamp and an insertion order makes equal-time inputs deterministic too.
 */
export class TimedInputQueue{
  entries=[];
  nextOrder=0;
  startTimestamp=null;
  closedAt=null;
  closedInclusive=true;

  reset(startTimestamp=null){
    this.entries=[];
    this.nextOrder=0;
    this.startTimestamp=Number.isFinite(startTimestamp)?startTimestamp:null;
    this.closedAt=null;
    this.closedInclusive=true;
  }

  get length(){
    return this.entries.length;
  }

  get pending(){
    return this.entries.slice();
  }

  get isClosed(){
    return this.closedAt!==null;
  }

  clear(){
    this.entries=[];
  }

  /**
   * Keep queued input aligned with a simulation clock that paused while the
   * document was hidden. Inputs whose new application time reaches the play
   * deadline can no longer affect that play and are discarded.
   */
  shiftPendingTimestamps(milliseconds,{before=Number.POSITIVE_INFINITY}={}){
    if(!Number.isFinite(milliseconds)||milliseconds<0)return 0;
    const previousLength=this.entries.length;
    this.entries=this.entries
      .map(entry=>({...entry,timestamp:entry.timestamp+milliseconds}))
      .filter(entry=>!Number.isFinite(before)||entry.timestamp<before);
    return previousLength-this.entries.length;
  }

  enqueue(inputOrX,y=null,timestamp=null){
    const input=inputOrX&&typeof inputOrX==='object'
      ?inputOrX
      :{x:inputOrX,y,timestamp};
    const x=Number(input.x);
    const pointY=Number(input.y);
    const time=Number(input.timestamp);
    if(!Number.isFinite(x)||!Number.isFinite(pointY)||!Number.isFinite(time))return false;
    if(this.startTimestamp!==null&&time<this.startTimestamp)return false;
    if(this.closedAt!==null){
      const within=this.closedInclusive?time<=this.closedAt:time<this.closedAt;
      if(!within)return false;
    }
    // The browser event stream is the source of same-time ordering.  Do not
    // accept caller-supplied order values that could reorder that stream.
    const order=this.nextOrder++;
    const entry={
      x,
      y:pointY,
      timestamp:time,
      order
    };
    if(input.action==='reflection')entry.action='reflection';
    else if(input.action==='root')entry.action='root';
    this.entries.push(entry);
    this.entries.sort((left,right)=>left.timestamp-right.timestamp||left.order-right.order);
    return true;
  }

  enqueueWithinLimit(input,{accepted=0,maximum=Number.POSITIVE_INFINITY,pendingCount=null}={}){
    if(!Number.isFinite(accepted)||accepted<0)return false;
    if(!(Number.isFinite(maximum)||maximum===Number.POSITIVE_INFINITY)||maximum<0)return false;
    const countPending=typeof pendingCount==='function'?pendingCount:()=>1;
    const pending=this.entries.reduce((count,entry)=>count+(countPending(entry)?1:0),0);
    if(accepted+pending>=maximum)return false;
    return this.enqueue(input);
  }

  /**
   * Stop accepting inputs at and after `timestamp`; already queued inputs
   * strictly before that boundary remain eligible.  Future-dated entries are
   * removed because they cannot belong to the play being finalized.
   */
  closeAt(timestamp,{inclusive=false}={}){
    if(!Number.isFinite(timestamp))return;
    if(this.closedAt===null||timestamp<this.closedAt){
      this.closedAt=timestamp;
      this.closedInclusive=inclusive;
    }else if(timestamp===this.closedAt){
      this.closedInclusive=this.closedInclusive&&inclusive;
    }
    this.entries=this.entries.filter(entry=>this.closedInclusive
      ?entry.timestamp<=this.closedAt
      :entry.timestamp<this.closedAt);
  }

  close(timestamp){
    this.closeAt(timestamp);
  }

  closeBefore(timestamp){
    this.closeAt(timestamp,{inclusive:false});
  }

  /**
   * Deliver every input whose timestamp is no later than the first fixed
   * boundary being processed.  Returns the number delivered.
   */
  drainThrough(boundaryTimestamp,deliver){
    if(typeof deliver!=='function')throw new TypeError('input delivery callback must be a function');
    if(!Number.isFinite(boundaryTimestamp))return 0;
    let delivered=0;
    while(this.entries.length>0){
      const entry=this.entries[0];
      const dueAtBoundary=entry.timestamp<=boundaryTimestamp+BOUNDARY_EPSILON_MS;
      const beforeClose=this.closedAt===null
        ?true
        :this.closedInclusive?entry.timestamp<=this.closedAt:entry.timestamp<this.closedAt;
      if(!dueAtBoundary||!beforeClose)break;
      const input=this.entries.shift();
      deliver(input);
      delivered++;
    }
    return delivered;
  }
}

export class FixedStepRunner{
  accumulator=0;
  lastTimestamp=null;
  originTimestamp=null;
  boundaryOriginTimestamp=null;
  boundaryStepIndex=0;
  processedBoundaryTimestamp=null;
  simulationTime=0;
  stepCount=0;
  suspendedAt=null;

  reset(timestamp=null){
    this.accumulator=0;
    this.lastTimestamp=Number.isFinite(timestamp)?timestamp:null;
    this.originTimestamp=Number.isFinite(timestamp)?timestamp:null;
    this.boundaryOriginTimestamp=Number.isFinite(timestamp)?timestamp:null;
    this.boundaryStepIndex=0;
    this.processedBoundaryTimestamp=Number.isFinite(timestamp)?timestamp:null;
    this.simulationTime=0;
    this.stepCount=0;
    this.suspendedAt=null;
  }

  suspend(timestamp=null){
    // Keep already accumulated visible time. resume() shifts the fixed
    // boundary clock by the hidden duration so hidden time itself is never
    // supplied to physics.
    if(this.suspendedAt===null&&Number.isFinite(timestamp))this.suspendedAt=timestamp;
    this.lastTimestamp=null;
  }

  resume(timestamp,{shiftTimeline=true}={}){
    // visibilitychange and pageshow can both report the same restoration.
    // Once resumed, a duplicate event must not move the wall-clock cursor or
    // shift the simulation timeline a second time.
    if(this.suspendedAt===null&&this.lastTimestamp!==null)return 0;
    const hiddenDuration=Number.isFinite(timestamp)&&Number.isFinite(this.suspendedAt)
      ?Math.max(0,timestamp-this.suspendedAt)
      :0;
    if(shiftTimeline&&hiddenDuration>0){
      if(Number.isFinite(this.originTimestamp))this.originTimestamp+=hiddenDuration;
      if(Number.isFinite(this.boundaryOriginTimestamp))this.boundaryOriginTimestamp+=hiddenDuration;
      if(Number.isFinite(this.processedBoundaryTimestamp))this.processedBoundaryTimestamp+=hiddenDuration;
    }
    this.lastTimestamp=Number.isFinite(timestamp)?timestamp:null;
    if(Number.isFinite(timestamp)&&this.boundaryOriginTimestamp===null){
      this.originTimestamp=timestamp;
      this.boundaryOriginTimestamp=timestamp;
      this.boundaryStepIndex=0;
      this.processedBoundaryTimestamp=timestamp;
    }
    this.suspendedAt=null;
    return hiddenDuration;
  }

  advance(timestamp,update){
    if(typeof update!=='function')throw new TypeError('fixed-step update must be a function');
    if(!Number.isFinite(timestamp))return 0;
    if(this.lastTimestamp===null){
      this.lastTimestamp=timestamp;
      this.originTimestamp=timestamp;
      this.boundaryOriginTimestamp=timestamp;
      this.boundaryStepIndex=0;
      this.processedBoundaryTimestamp=timestamp;
      return 0;
    }
    // A browser clock should be monotonic, but a synthetic RAF or restored
    // document can still report an older timestamp.  Do not move the origin
    // backwards and create artificial elapsed time on the next frame.
    if(timestamp<this.lastTimestamp)timestamp=this.lastTimestamp;

    const elapsed=Math.max(0,(timestamp-this.lastTimestamp)/1000);
    this.lastTimestamp=timestamp;
    this.accumulator=Math.min(MAX_ACCUMULATED_SECONDS,this.accumulator+elapsed);

    let steps=0;
    while(this.accumulator+EPSILON>=FIXED_STEP_SECONDS&&steps<MAX_FIXED_STEPS_PER_FRAME){
      this.accumulator=Math.max(0,this.accumulator-FIXED_STEP_SECONDS);
      const nextSimulationTime=this.simulationTime+FIXED_STEP_SECONDS;
      this.boundaryStepIndex++;
      const boundaryTimestamp=this.boundaryOriginTimestamp===null
        ?timestamp
        :this.boundaryOriginTimestamp+this.boundaryStepIndex*FIXED_STEP_SECONDS*1000;
      update(FIXED_STEP_SECONDS,{
        boundaryTimestamp,
        simulationTime:nextSimulationTime,
        stepIndex:this.stepCount
      });
      this.simulationTime=nextSimulationTime;
      this.processedBoundaryTimestamp=boundaryTimestamp;
      this.stepCount++;
      steps++;
    }

    return steps;
  }

  isCaughtUp(){
    return this.accumulator+EPSILON<FIXED_STEP_SECONDS;
  }

  hasPendingSteps(){
    return !this.isCaughtUp();
  }
}

/**
 * Advance one visible PLAYING render frame. The deadline is clamped before
 * elapsed time enters the accumulator, then any backlog is drained over
 * later renders by FixedStepRunner's per-frame limit.
 */
export function advancePlayFrame({
  timestamp,
  deadline=null,
  tutorial=false,
  runner,
  inputQueue,
  update
}){
  if(!runner||typeof runner.advance!=='function'||typeof runner.isCaughtUp!=='function'){
    throw new TypeError('play frame requires a fixed-step runner');
  }
  if(typeof update!=='function')throw new TypeError('play frame requires an update callback');
  const deadlineExpired=!tutorial&&Number.isFinite(deadline)&&timestamp>=deadline;
  if(deadlineExpired){
    if(!inputQueue||typeof inputQueue.closeBefore!=='function'){
      throw new TypeError('deadline settlement requires a timed input queue');
    }
    inputQueue.closeBefore(deadline);
  }
  const effectiveTimestamp=deadlineExpired?deadline:timestamp;
  const steps=runner.advance(effectiveTimestamp,update);
  const caughtUp=runner.isCaughtUp();
  return{
    steps,
    deadlineExpired,
    caughtUp,
    shouldFinish:deadlineExpired&&caughtUp
  };
}

/**
 * Drain deadline backlog in bounded chunks that are independent from the
 * browser's render rate. Each internal frame still honours the normal
 * three-fixed-step limit; the caller yields between chunks so a throttled RAF
 * cannot turn the result transition into a minutes-long wait.
 */
export function settlePlayDeadline({
  deadline,
  runner,
  inputQueue,
  update,
  maxFrames=60
}){
  if(!Number.isFinite(deadline))throw new TypeError('deadline settlement requires a finite deadline');
  if(!Number.isInteger(maxFrames)||maxFrames<1){
    throw new TypeError('deadline settlement requires a positive frame limit');
  }
  let frame=null;
  let settlementFrames=0;
  do{
    frame=advancePlayFrame({
      timestamp:deadline,
      deadline,
      tutorial:false,
      runner,
      inputQueue,
      update
    });
    settlementFrames++;
  }while(!frame.shouldFinish&&settlementFrames<maxFrames);
  return{...frame,settlementFrames};
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
