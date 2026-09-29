/** Clearing work follows elapsed time, independently of display refresh rate. */
export function createSweepBudget(options={}) {
  const settings=options&&typeof options==='object'?options:{};
  const safeValue=(value,fallback)=>Number.isFinite(value)&&value>=0?value:fallback;
  const rate=safeValue(settings.rate,2.25),capacity=safeValue(settings.capacity,.22);
  let available=capacity,previous=null,total=0;
  function take(now,requested){
    if(!Number.isFinite(now)||!Number.isFinite(requested)||requested<=0)return 0;
    if(previous===null)previous=now;
    else if(now>previous){
      if(rate>0)available=Math.min(capacity,available+(now-previous)/1000*rate);
      previous=now;
    }
    const granted=Math.min(available,requested);
    available=Math.max(0,available-granted);total=Math.min(Number.MAX_VALUE,total+granted);
    return granted;
  }
  /** Allocate one clock grant across every segment, including curved coalesced paths. */
  function takeBatch(now,requests){
    if(!Array.isArray(requests))return [];
    const amounts=requests.map(value=>Number.isFinite(value)&&value>0?value:0);
    let requested=0,scale=0,last=-1;
    for(let i=0;i<amounts.length;i++){
      requested=Math.min(capacity,requested+amounts[i]);
      if(amounts[i]>0){scale=Math.max(scale,amounts[i]);last=i;}
    }
    const granted=take(now,requested);
    if(!granted||!scale)return amounts.map(()=>0);
    const weight=amounts.reduce((sum,value)=>sum+value/scale,0);
    let remaining=granted;
    return amounts.map((value,index)=>{
      if(!value)return 0;
      const allocation=Math.min(value,remaining,index===last?remaining:granted*(value/scale)/weight);
      remaining=Math.max(0,remaining-allocation);
      return allocation;
    });
  }
  return {take,takeBatch,getState:()=>({available,total,rate,capacity})};
}
