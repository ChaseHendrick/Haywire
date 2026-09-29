import test from 'node:test';
import assert from 'node:assert/strict';
import {createSweepBudget} from '../input.js';

test('movement work is bounded by elapsed time at 30, 60, and 144 Hz',()=>{
  for(const hz of [30,60,144]){
    const budget=createSweepBudget();
    for(let frame=0;frame<=hz*10;frame++)budget.take(frame*1000/hz,.8);
    assert(Math.abs(budget.getState().total-(.22+22.5))<1e-8);
  }
});
test('rapid clicks and coalesced events share one budget instead of creating work',()=>{
  const budget=createSweepBudget();
  assert.equal(budget.take(0,.06),.06);
  const shared=Array.from({length:50},()=>budget.take(0,.8)).reduce((a,b)=>a+b,0);
  assert(Math.abs(shared-.16)<1e-8);
  assert.equal(budget.take(0,.06),0);
  assert(budget.take(1000,.8)<=.22);
});
test('idle gaps and invalid input cannot create unbounded clearing credit',()=>{
  const budget=createSweepBudget();budget.take(0,.22);
  assert.equal(budget.take(99999999,999999),.22);
  const before=budget.getState();
  for(const value of [NaN,Infinity,-1])assert.equal(budget.take(99999999,value),0);
  assert.deepEqual(budget.getState(),before);
});

test('earlier timestamps cannot refill the same clock interval twice',()=>{
  const budget=createSweepBudget();
  budget.take(1000,.22);
  assert.equal(budget.take(0,.22),0);
  assert.equal(budget.take(1000,.22),0);
  const first=budget.take(1040,.22);
  assert(Math.abs(first-.09)<1e-12);
  assert.equal(budget.take(1000,.22),0);
  assert.equal(budget.take(1040,.22),0);
  assert(Math.abs(budget.take(1080,.22)-.09)<1e-12);
});

test('one curved polyline shares clearing across every segment proportionally',()=>{
  const budget=createSweepBudget();
  const segments=[.08,.20,.04,.12];
  const allocations=budget.takeBatch(0,segments);
  assert.equal(allocations.length,segments.length);
  assert(allocations.every(value=>value>0),'Later turns must receive actual clearing work');
  assert(Math.abs(allocations.reduce((sum,value)=>sum+value,0)-.22)<1e-12);
  for(let i=0;i<segments.length;i++)assert(Math.abs(allocations[i]/segments[i]-.5)<1e-12);
  assert.deepEqual(budget.takeBatch(0,segments),[0,0,0,0]);
  const later=budget.takeBatch(40,segments);
  assert(later.every(value=>value>0));
  assert(Math.abs(later.reduce((sum,value)=>sum+value,0)-.09)<1e-12);
});

test('mixed clicks, keyboard holds, and coalesced paths spend one clock budget',()=>{
  const budget=createSweepBudget();
  let granted=budget.take(0,.06);
  for(let now=0;now<=1000;now+=10){
    granted+=budget.take(now,.12);
    granted+=budget.takeBatch(now,[.2,.05,.1]).reduce((sum,value)=>sum+value,0);
    granted+=budget.take(now,.06);
  }
  assert(Math.abs(granted-(.22+2.25))<1e-10);
  assert(Math.abs(budget.getState().total-granted)<1e-10);
});

test('invalid batch entries cannot spend work or corrupt proportional allocations',()=>{
  const budget=createSweepBudget();
  const before=budget.getState();
  assert.deepEqual(budget.takeBatch(NaN,[.1,.1]),[0,0]);
  assert.deepEqual(budget.takeBatch(0,[NaN,Infinity,-1,0,'1']),[0,0,0,0,0]);
  assert.deepEqual(budget.takeBatch(0,null),[]);
  assert.deepEqual(budget.getState(),before);
  const normal=budget.takeBatch(0,[.05,0,.10,NaN]);
  assert(Math.abs(normal[0]-.05)<1e-12);
  assert(Math.abs(normal[2]-.10)<1e-12);
  assert.equal(normal[1],0);assert.equal(normal[3],0);
  const extreme=budget.takeBatch(1000,[Number.MAX_VALUE,Number.MAX_VALUE]);
  assert(extreme.every(Number.isFinite));
  assert(Math.abs(extreme[0]-.11)<1e-12&&Math.abs(extreme[1]-.11)<1e-12);
});

test('malformed settings recover defaults and zero rates remain finite',()=>{
  for(const options of [null,7,{rate:NaN,capacity:Infinity},{rate:-1,capacity:-1}]){
    const budget=createSweepBudget(options),state=budget.getState();
    assert.equal(state.rate,2.25);assert.equal(state.capacity,.22);
    assert.equal(budget.take(0,1),.22);
    assert.equal(budget.take(1000,1),.22);
  }
  const frozen=createSweepBudget({rate:0,capacity:.1});
  assert.equal(frozen.take(-Number.MAX_VALUE,1),.1);
  assert.equal(frozen.take(Number.MAX_VALUE,1),0);
  assert(Object.values(frozen.getState()).every(Number.isFinite));
  const disabled=createSweepBudget({capacity:0});
  assert.deepEqual(disabled.takeBatch(1000,[.1,.2]),[0,0]);
  assert.equal(disabled.take(2000,1),0);
});
