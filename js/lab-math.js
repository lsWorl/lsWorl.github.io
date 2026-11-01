/* Small, explicit numerical models used by the homepage visualizations. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LabMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function softmaxTrace(logits, temperature = 1, topK = logits.length) {
    if (!(temperature > 0) || !Number.isFinite(temperature)) throw new Error('Temperature must be positive.');
    const eligible = logits.map((value, index) => ({value,index})).filter(item=>Number.isFinite(item.value))
      .sort((a,b)=>b.value-a.value || a.index-b.index).slice(0, Math.max(1,topK));
    const result = logits.map(()=>0);
    const max = eligible.length ? eligible[0].value : 0;
    const weights = eligible.map(item=>Math.exp((item.value-max)/temperature));
    const total = weights.reduce((a,b)=>a+b,0);
    eligible.forEach((item,index)=>{result[item.index]=weights[index]/total;});
    return {logits:logits.slice(),temperature,eligible:eligible.map(item=>item.index),max,
      scaled:logits.map(value=>value/temperature),weights:logits.map((_,i)=>{
        const index=eligible.findIndex(item=>item.index===i);return index<0?0:weights[index];
      }),total,probabilities:result};
  }
  function softmax(logits, temperature = 1, topK = logits.length) {
    return softmaxTrace(logits,temperature,topK).probabilities;
  }
  const dot = (a,b) => a.reduce((sum,value,index)=>sum+value*b[index],0);
  function attention(queries, keys, causal = false, temperature = 1) {
    return queries.map((query,row)=>softmax(keys.map((key,column)=>
      causal && column>row ? -Infinity : dot(query,key)/Math.sqrt(query.length)), temperature));
  }
  function random(seed) {
    return () => { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  }
  function network(seed = 27) {
    const rng=random(seed);
    return {w:Array.from({length:4},()=>[rng()*2-1,rng()*2-1]),b:Array.from({length:4},()=>rng()-.5),v:Array.from({length:4},()=>rng()*2-1),c:0};
  }
  function forward(net,x) {
    const preactivation=net.w.map((weights,j)=>dot(weights,x)+net.b[j]);
    const hidden=preactivation.map(value=>Math.tanh(value));
    const z=dot(net.v,hidden)+net.c;
    const output=1/(1+Math.exp(-z));
    return {hidden,output,preactivation,z};
  }
  const datasets = {
    xor: [{x:[-1,-1],y:0},{x:[-1,1],y:1},{x:[1,-1],y:1},{x:[1,1],y:0}],
    linear: [{x:[-1,-1],y:0},{x:[-1,1],y:0},{x:[1,-1],y:1},{x:[1,1],y:1}]
  };
  function gradients(net,data) {
    const g={w:net.w.map(()=>[0,0]),b:net.b.map(()=>0),v:net.v.map(()=>0),c:0};
    let loss=0,correct=0;
    for (const {x,y} of data) {
      const {hidden,output}=forward(net,x);
      const p=Math.max(1e-10,Math.min(1-1e-10,output));
      loss-=y*Math.log(p)+(1-y)*Math.log(1-p);
      correct+=(output>=.5 ? 1:0)===y ? 1:0;
      const delta=output-y;
      g.c+=delta/data.length;
      hidden.forEach((h,j)=>{
        g.v[j]+=delta*h/data.length;
        const d=delta*net.v[j]*(1-h*h)/data.length;
        g.b[j]+=d;
        x.forEach((value,k)=>{g.w[j][k]+=d*value;});
      });
    }
    return {gradient:g,loss:loss/data.length,accuracy:correct/data.length};
  }
  function train(net,data,rate,steps=1) {
    for(let step=0;step<steps;step++) {
      const {gradient:g}=gradients(net,data);
      net.c-=rate*g.c;
      net.w.forEach((weights,j)=>{
        net.b[j]-=rate*g.b[j]; net.v[j]-=rate*g.v[j];
        weights.forEach((_,k)=>{net.w[j][k]-=rate*g.w[j][k];});
      });
    }
    return gradients(net,data);
  }
  return {softmax,dot,attention,random,network,forward,gradients,train,datasets};
});
