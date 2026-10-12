/* Small, explicit numerical models used by the browser experiments. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LabMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function softmax(logits, temperature = 1, topK = logits.length) {
    if (!(temperature > 0) || !Number.isFinite(temperature)) throw new Error('Temperature must be positive.');
    const eligible = logits.map((value, index) => ({value,index})).filter(item=>Number.isFinite(item.value))
      .sort((a,b)=>b.value-a.value || a.index-b.index).slice(0, Math.max(1,topK));
    const result = logits.map(()=>0);
    if (!eligible.length) return result;
    const max = eligible[0].value;
    const weights = eligible.map(item=>Math.exp((item.value-max)/temperature));
    const total = weights.reduce((a,b)=>a+b,0);
    eligible.forEach((item,index)=>{result[item.index]=weights[index]/total;});
    return result;
  }
  const dot = (a,b) => a.reduce((sum,value,index)=>sum+value*b[index],0);
  const cosine = (a,b) => {
    const denominator = Math.sqrt(dot(a,a)*dot(b,b));
    return denominator ? dot(a,b)/denominator : 0;
  };
  function attention(queries, keys, causal = false, temperature = 1) {
    return queries.map((query,row)=>softmax(keys.map((key,column)=>
      causal && column>row ? -Infinity : dot(query,key)/Math.sqrt(query.length)), temperature));
  }
  const vocabulary = ['模型','微调','显存','量化','检索','文档','注意力','训练','参数','向量','知识','学习率','损失','lora','qlora','rag','transformer'];
  function counts(text) {
    const lower=text.toLowerCase();
    return vocabulary.map(term=>/^[a-z]+$/.test(term)
      ? (lower.match(new RegExp('\\b'+term+'\\b','g'))||[]).length
      : lower.split(term).length-1);
  }
  function retrieve(query, documents, topK = 3) {
    const vectors=documents.map(doc=>counts(doc.title+' '+doc.text));
    const idf=vocabulary.map((_,index)=>Math.log((1+documents.length)/(1+vectors.filter(v=>v[index]>0).length))+1);
    const q=counts(query).map((value,index)=>value*idf[index]);
    return documents.map((doc,index)=>({...doc,score:cosine(q,vectors[index].map((value,j)=>value*idf[j]))}))
      .sort((a,b)=>b.score-a.score || a.id-b.id).filter(doc=>doc.score>0).slice(0,topK);
  }
  function contextFor(documents, budget) {
    let remaining=budget;
    return documents.flatMap(doc=>{
      if (remaining<=0) return [];
      const chars=Array.from(doc.text);
      const take=Math.min(remaining,chars.length);
      remaining-=take;
      return [{...doc,excerpt:chars.slice(0,take).join(''),truncated:take<chars.length}];
    });
  }
  function random(seed) {
    return () => { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  }
  function network(seed = 27) {
    const rng=random(seed);
    return {w:Array.from({length:4},()=>[rng()*2-1,rng()*2-1]),b:Array.from({length:4},()=>rng()-.5),v:Array.from({length:4},()=>rng()*2-1),c:0};
  }
  function forward(net,x) {
    const hidden=net.w.map((weights,j)=>Math.tanh(dot(weights,x)+net.b[j]));
    const z=dot(net.v,hidden)+net.c;
    const output=1/(1+Math.exp(-z));
    return {hidden,output};
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
  return {softmax,dot,cosine,attention,retrieve,contextFor,network,forward,gradients,train,datasets};
});
