/* js/lab-math.js */
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

;
/* js/ai-experiments.js */
/* Local interactive examples. No remote model or third-party runtime required. */
(() => {
  'use strict';
  let M = window.LabMath;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const element = (tag, cls, text) => {
    const node=document.createElement(tag);
    if(cls) node.className=cls;
    if(text!==undefined) node.textContent=text;
    return node;
  };
  const svg = (tag,attrs) => {
    const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));
    return node;
  };

  function sampling(root) {
    const words=['好','冷','热','糟','猫'];
    const logits=[...root.querySelectorAll('[data-token-logit]')];
    const temperature=root.querySelector('#sampling-temperature');
    const topK=root.querySelector('#sampling-top-k');
    const button=root.querySelector('[data-sample-run]');
    let counts=words.map(()=>0), probabilities=[], frame=null, batch=0, last=0;
    const stop=()=>{if(frame!==null) cancelAnimationFrame(frame);frame=null;button.textContent='采样 100 次';};
    function render() {
      probabilities=M.softmax(logits.map(input=>Number(input.value)||0),Number(temperature.value),Number(topK.value));
      const total=counts.reduce((a,b)=>a+b,0);
      root.querySelector('#sampling-temperature-value').textContent=Number(temperature.value).toFixed(1);
      root.querySelector('#sampling-top-k-value').textContent=topK.value;
      words.forEach((word,index)=>{
        root.querySelector(`[data-token-prob="${index}"]`).style.width=probabilities[index]*100+'%';
        root.querySelector(`[data-token-observed="${index}"]`).style.width=(total ? counts[index]/total*100:0)+'%';
        root.querySelector(`[data-token-label="${index}"]`).textContent=`${(probabilities[index]*100).toFixed(1)}% · ${counts[index]} 次`;
        root.querySelector(`[data-token-row="${index}"]`).classList.toggle('is-muted',probabilities[index]===0);
      });
      root.querySelector('[data-sampling-status]').textContent=total ? `已采样 ${total} 次` : '尚未采样';
    }
    function sample() {
      const draw=Math.random(); let sum=0,index=probabilities.length-1;
      for(let i=0;i<probabilities.length;i++) {sum+=probabilities[i];if(draw<sum){index=i;break;}}
      counts[index]++;
      const output=root.querySelector('[data-sampled-token]');
      output.textContent=words[index];
      root.querySelectorAll('[data-token-row]').forEach((row,i)=>row.classList.toggle('is-sampled',i===index));
      render();
    }
    const reset=()=>{stop();counts=words.map(()=>0);root.querySelector('[data-sampled-token]').textContent='…';render();};
    [...logits,temperature,topK].forEach(input=>input.addEventListener('input',reset));
    root.querySelector('[data-sample-once]').addEventListener('click',()=>{stop();sample();});
    root.querySelector('[data-sample-reset]').addEventListener('click',reset);
    button.addEventListener('click',()=>{
      if(frame!==null){stop();return;}
      batch=0;last=0;
      if(reduced()){for(let i=0;i<100;i++)sample();return;}
      button.textContent='暂停采样';
      function tick(time) {
        if(time-last>=32){sample();batch++;last=time;}
        if(batch>=100){stop();return;}
        frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);
    });
    render(); return stop;
  }

  function attention(root) {
    const words=['我','在','学习','AI'];
    const keys=[[1,0,0,0],[0,.8,.2,0],[0,.3,1,.4],[0,.1,.8,1]];
    const queries=keys.map(vector=>vector.slice());
    let selected=2;
    const grid=root.querySelector('[data-attention-grid]');
    const mask=root.querySelector('[data-causal-mask]');
    const inputs=[...root.querySelectorAll('[data-query-dimension]')];
    const cells=[];
    grid.append(element('span','ai-matrix-corner','Q / K'));
    words.forEach(word=>grid.append(element('span','ai-matrix-label',word)));
    words.forEach((word,row)=>{
      grid.append(element('span','ai-matrix-label',word));
      words.forEach((target,column)=>{
        const cell=element('button','ai-matrix-cell');cell.type='button';
        cell.dataset.attentionCell=`${row}-${column}`;
        cell.addEventListener('click',()=>select(row));
        grid.append(cell);cells.push({cell,row,column});
      });
    });
    function render() {
      const weights=M.attention(queries,keys,mask.checked);
      root.querySelectorAll('[data-query-token]').forEach((button,index)=>button.setAttribute('aria-pressed',String(index===selected)));
      cells.forEach(({cell,row,column})=>{
        const blocked=mask.checked&&column>row;
        cell.textContent=blocked ? '—':(weights[row][column]*100).toFixed(0)+'%';
        cell.setAttribute('aria-label',`${words[row]}关注${words[column]}：${blocked?'已屏蔽':(weights[row][column]*100).toFixed(1)+'%'}`);
        cell.style.backgroundColor=blocked?'var(--lab-soft)':`rgba(109,99,177,${.06+weights[row][column]*.76})`;
        cell.classList.toggle('is-query-row',row===selected);
        cell.classList.toggle('is-masked',blocked);
      });
      inputs.forEach((input,index)=>{root.querySelector('#query-value-'+index).textContent=queries[selected][index].toFixed(1);});
      root.querySelector('[data-query-label]').textContent='查询词：'+words[selected];
      const details=root.querySelector('[data-attention-scores]');details.replaceChildren();
      words.forEach((word,column)=>{
        const row=element('div','ai-score-row');
        row.append(element('span','',word),element('span','',`分数 ${(M.dot(queries[selected],keys[column])/2).toFixed(2)}`),
          element('strong','',mask.checked&&column>selected?'已屏蔽':(weights[selected][column]*100).toFixed(1)+'%'));
        details.append(row);
      });
    }
    function select(index) {selected=index;inputs.forEach((input,i)=>{input.value=queries[index][i];});render();}
    root.querySelectorAll('[data-query-token]').forEach((button,index)=>button.addEventListener('click',()=>select(index)));
    inputs.forEach((input,index)=>input.addEventListener('input',()=>{queries[selected][index]=Number(input.value);render();}));
    mask.addEventListener('change',render);
    select(selected);return ()=>{};
  }

  function rag(root) {
    const documents=[
      {id:1,title:'LoRA',text:'LoRA 冻结模型的原始参数，只训练低秩适配器中的少量参数，减少微调时需要保存的梯度与优化器状态。'},
      {id:2,title:'QLoRA',text:'QLoRA 使用低比特量化保存模型权重，并训练 LoRA 适配器。量化可以降低模型权重占用的显存，适合显存有限时的微调。'},
      {id:3,title:'RAG',text:'RAG 先从外部文档中检索相关知识，再把问题和检索内容放入模型上下文。文档可以单独更新，无需为了补充知识而重新训练模型。'},
      {id:4,title:'Transformer',text:'Transformer 通过注意力计算查询向量和键向量的匹配分数，再对值向量加权。因果注意力会屏蔽当前位置后面的词。'},
      {id:5,title:'梯度下降',text:'梯度下降根据损失对模型参数的梯度更新参数。学习率控制每次更新的大小，过大的学习率可能让训练震荡或发散。'}
    ];
    const query=root.querySelector('#rag-query'), topK=root.querySelector('#rag-top-k'), budget=root.querySelector('#rag-budget');
    const button=root.querySelector('[data-rag-run]');let frame=null;
    const stop=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;button.textContent='演示流程';};
    function stage(index,done=false) {
      root.querySelectorAll('[data-rag-stage]').forEach((node,i)=>{
        node.classList.toggle('is-active',i===index&&!done);node.classList.toggle('is-complete',i<index||done);
      });
      root.querySelector('.ai-pipeline').style.setProperty('--pipeline-progress',String(done?1:index/2));
    }
    function render() {
      const found=M.retrieve(query.value,documents,Number(topK.value));
      const context=M.contextFor(found,Number(budget.value));
      root.querySelector('#rag-top-k-value').textContent=topK.value;
      root.querySelector('#rag-budget-value').textContent=budget.value;
      const list=root.querySelector('[data-retrieval-list]');list.replaceChildren();
      if(!found.length) list.append(element('p','ai-empty','没有匹配到示例关键词。可尝试“显存”“微调”“文档”“注意力”等词。'));
      found.forEach((doc,index)=>{
        const card=element('div','ai-retrieval-card');
        const heading=element('div','ai-retrieval-heading');
        heading.append(element('strong','',`${index+1}. ${doc.title}`),element('span','',`相似度 ${doc.score.toFixed(3)}`));
        const track=element('div','ai-bar-track');const fill=element('div','ai-bar-fill');fill.style.width=doc.score*100+'%';track.append(fill);
        card.append(heading,track,element('p','',doc.text));list.append(card);
      });
      const used=context.reduce((n,doc)=>n+Array.from(doc.excerpt).length,0);
      root.querySelector('[data-context-size]').textContent=`${used} / ${budget.value} 字符`;
      const source=context.map(doc=>`[${doc.id}] ${doc.title}\n${doc.excerpt}${doc.truncated?'…':''}`).join('\n\n');
      root.querySelector('[data-rag-context]').textContent=`问题：${query.value||'（空）'}\n\n参考资料：\n${source||'（无匹配资料）'}\n\n请根据参考资料回答，并标明引用来源。`;
      root.querySelector('[data-rag-status]').textContent=found.length?`检索到 ${found.length} 篇相关资料`:'没有匹配资料';
      stage(0);
    }
    [query,topK,budget].forEach(input=>input.addEventListener('input',()=>{stop();render();}));
    root.querySelectorAll('[data-rag-question]').forEach(control=>control.addEventListener('click',()=>{stop();query.value=control.dataset.ragQuestion;render();}));
    button.addEventListener('click',()=>{
      if(frame!==null){stop();return;}
      render();if(reduced()){stage(2,true);return;}
      const start=performance.now();button.textContent='停止演示';
      const captions=['1 / 3 · 计算问题的关键词向量','2 / 3 · 计算相似度并检索文档','3 / 3 · 按预算组装上下文'];
      function tick(time) {
        const index=Math.min(2,Math.floor((time-start)/500));stage(index);
        root.querySelector('[data-rag-status]').textContent=captions[index];
        if(time-start>=1600){stage(2,true);stop();root.querySelector('[data-rag-status]').textContent='上下文已组装，示例未调用生成模型';return;}
        frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);
    });
    render();return stop;
  }

  function network(root) {
    const rate=root.querySelector('#network-learning-rate');
    const run=root.querySelector('[data-network-run]');
    const cells=root.querySelector('[data-boundary-cells]'),points=root.querySelector('[data-network-points]');
    let net=M.network(),dataset='xor',epoch=0,losses=[],frame=null,last=0;
    const grid=[];
    for(let row=0;row<24;row++)for(let col=0;col<24;col++) {
      const cell=svg('rect',{x:50+col*15,y:20+row*11.25,width:15.3,height:11.55});
      cells.append(cell);grid.push({cell,x:[-1.5+(col+.5)/24*3,1.5-(row+.5)/24*3]});
    }
    const stop=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;run.textContent='开始训练';};
    function render() {
      const metric=M.gradients(net,M.datasets[dataset]);
      root.querySelector('#network-rate-value').textContent=Number(rate.value).toFixed(2);
      root.querySelector('[data-network-epoch]').textContent=epoch;
      root.querySelector('[data-network-loss]').textContent=metric.loss.toFixed(4);
      root.querySelector('[data-network-accuracy]').textContent=Math.round(metric.accuracy*100)+'%';
      grid.forEach(({cell,x})=>{
        const probability=M.forward(net,x).output;
        cell.setAttribute('fill',`rgb(${Math.round(165-61*probability)},${Math.round(199-80*probability)},${Math.round(225-42*probability)})`);
      });
      const predictions=root.querySelector('[data-network-predictions]');predictions.replaceChildren();points.replaceChildren();
      M.datasets[dataset].forEach(({x,y})=>{
        const output=M.forward(net,x).output;
        const row=element('div','ai-score-row');row.append(element('span','',`(${x.join(', ')}) → ${y}`),element('strong','',`p(1) = ${output.toFixed(3)}`));predictions.append(row);
        points.append(svg('circle',{cx:50+(x[0]+1.5)/3*360,cy:20+(1.5-x[1])/3*270,r:10,fill:y?'#7961b6':'#a5c7e1',stroke:'white','stroke-width':3}));
      });
      const max=Math.max(1,...losses.map(entry=>entry.loss));
      root.querySelector('[data-network-loss-line]').setAttribute('d',losses.map((entry,index)=>`${index?'L':'M'}${20+(epoch?entry.epoch/epoch:0)*400},${85-entry.loss/max*68}`).join(' '));
      root.querySelector('[data-network-status]').textContent=epoch ? metric.loss<.018?'训练完成，四个样本均已正确分类':`已训练 ${epoch} 步`:'网络已初始化';
      return metric;
    }
    function step() {
      M.train(net,M.datasets[dataset],Number(rate.value),Math.min(50,3000-epoch));epoch=Math.min(3000,epoch+50);
      const metric=M.gradients(net,M.datasets[dataset]);losses.push({epoch,loss:metric.loss});render();
      return epoch>=3000 || (metric.loss<.018&&metric.accuracy===1);
    }
    function reset() {stop();net=M.network();epoch=0;losses=[{epoch:0,loss:M.gradients(net,M.datasets[dataset]).loss}];render();}
    root.querySelectorAll('[data-network-dataset]').forEach(button=>button.addEventListener('click',()=>{
      dataset=button.dataset.networkDataset;root.querySelectorAll('[data-network-dataset]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));reset();
    }));
    rate.addEventListener('input',render);
    root.querySelector('[data-network-reset]').addEventListener('click',reset);
    root.querySelector('[data-network-step]').addEventListener('click',()=>{stop();step();});
    run.addEventListener('click',()=>{
      if(frame!==null){stop();return;}
      if(epoch>=3000)reset();
      if(reduced()){while(!step()){} return;}
      run.textContent='暂停训练';last=0;
      function tick(time) {
        if(time-last>=85){last=time;if(step()){stop();return;}}
        frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);
    });
    reset();return stop;
  }

  window.setupGradientExperiment=root=>{
    const rate=root.querySelector('#lab-learning-rate'),initial=root.querySelector('#lab-start-weight'),speed=root.querySelector('#lab-playback-speed');
    const button=root.querySelector('[data-lab-run]');
    let weight=Number(initial.value),history=[weight],frame=null,animation=null,playing=false;
    const stop=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;animation=null;playing=false;button.textContent='连续播放';draw(weight);};
    const finished=()=>history.length>40||Math.abs(weight)<.0001||Math.abs(weight)>1000;
    const number=value=>Math.abs(value)>=10000?value.toExponential(2):value.toFixed(4);
    function draw(displayWeight=weight) {
      const domain=Math.max(4.5,...history.map(w=>Math.abs(w)))*1.04;
      const x=w=>60+(w+domain)/(domain*2)*540,y=loss=>320-loss/(domain*domain)*280;
      const grid=root.querySelector('[data-plot-grid]');grid.replaceChildren();
      for(let i=-2;i<=2;i++){
        const value=domain*i/2;
        grid.append(svg('line',{x1:x(value),x2:x(value),y1:40,y2:320,class:i===0?'lab-plot-axis':'lab-plot-grid'}));
        const label=svg('text',{x:x(value),y:342,'text-anchor':'middle',class:'lab-tick'});label.textContent=i?value.toFixed(1):'0';grid.append(label);
      }
      for(let i=0;i<=4;i++){
        const value=domain*domain*i/4;
        grid.append(svg('line',{x1:60,x2:600,y1:y(value),y2:y(value),class:i===0?'lab-plot-axis':'lab-plot-grid'}));
        const label=svg('text',{x:49,y:y(value)+4,'text-anchor':'end',class:'lab-tick'});label.textContent=value>=10000?value.toExponential(0):value.toFixed(0);grid.append(label);
      }
      const curve=[];
      for(let i=0;i<=100;i++){const w=-domain+i/100*domain*2;curve.push(`${i?'L':'M'}${x(w)},${y(w*w)}`);}
      root.querySelector('[data-plot-curve]').setAttribute('d',curve.join(' '));
      const steps=root.querySelector('[data-plot-steps]');steps.replaceChildren();
      const settled=animation?history.slice(0,-1):history;
      steps.append(svg('polyline',{points:[...settled,displayWeight].map(w=>`${x(w)},${y(w*w)}`).join(' '),fill:'none',class:'lab-plot-path'}));
      settled.forEach(w=>steps.append(svg('circle',{cx:x(w),cy:y(w*w),r:3.5,class:'lab-plot-point'})));
      steps.append(svg('circle',{cx:x(displayWeight),cy:y(displayWeight*displayWeight),r:8,class:'lab-plot-point-current'}));
    }
    function render() {
      root.querySelector('#lab-rate-value').textContent=Number(rate.value).toFixed(2);
      root.querySelector('#lab-weight-value').textContent=Number(initial.value).toFixed(1);
      root.querySelector('#lab-speed-value').textContent=Number(speed.value).toFixed(1)+'×';
      root.querySelector('[data-lab-iteration]').textContent=history.length-1;
      root.querySelector('[data-lab-weight]').textContent=number(weight);
      root.querySelector('[data-lab-loss]').textContent=number(weight*weight);
      const eta=Number(rate.value);
      let status='等待开始',description='点击前进一步或连续播放，观察参数与损失的变化。';
      if(Math.abs(weight)<.0001){status='已接近最小值';description='参数和损失都接近 0，可换一组参数再试。';}
      else if(history.length>1){
        if(eta<.5){status='平稳收敛';description='参数向 0 靠近。较小的学习率需要更多步数。';}
        else if(eta<1){status='震荡收敛';description='参数交替越过 0，但幅度逐步缩小。';}
        else if(eta===1){status='等幅震荡';description='更新系数为 −1，参数换侧，损失保持不变。';}
        else{status='正在发散';description='更新系数绝对值大于 1，参数离 0 越来越远。';}
      }
      if(history.length>40)description+=' 本轮已达到 40 步。';
      root.querySelector('[data-lab-status]').textContent=status;root.querySelector('[data-lab-explanation]').textContent=description;
    }
    function begin(time) {
      if(finished()){stop();return;}
      const from=weight;weight*=1-2*Number(rate.value);history.push(weight);
      animation={from,to:weight,start:time,duration:620/Number(speed.value)};render();
    }
    function tick(time) {
      if(!animation){frame=null;return;}
      const t=Math.min(1,(time-animation.start)/animation.duration),eased=1-Math.pow(1-t,3);
      draw(animation.from+(animation.to-animation.from)*eased);
      if(t===1){animation=null;draw(weight);if(playing&&!finished())begin(time);else{stop();return;}}
      frame=requestAnimationFrame(tick);
    }
    function step() {
      if(finished())return;
      if(reduced()){weight*=1-2*Number(rate.value);history.push(weight);render();draw();return;}
      begin(performance.now());frame=requestAnimationFrame(tick);
    }
    const reset=()=>{stop();weight=Number(initial.value);history=[weight];render();draw();};
    [rate,initial].forEach(input=>input.addEventListener('input',reset));
    speed.addEventListener('input',()=>{root.querySelector('#lab-speed-value').textContent=Number(speed.value).toFixed(1)+'×';});
    root.querySelector('[data-lab-step]').addEventListener('click',()=>{stop();step();});
    root.querySelector('[data-lab-reset]').addEventListener('click',reset);
    button.addEventListener('click',()=>{
      if(playing||animation){stop();return;}
      if(finished())reset();
      if(reduced()){while(!finished())step();return;}
      playing=true;button.textContent='暂停播放';step();
    });
    document.addEventListener('lab:panel-change',stop);
    reset();return ()=>{stop();document.removeEventListener('lab:panel-change',stop);};
  };

  const sessions = new WeakMap();
  window.initAILabs=()=>{
    const tablist=document.querySelector('.ai-tabs');
    if(!tablist)return ()=>{};
    M=window.LabMath;
    if(sessions.has(tablist)) {
      const session=sessions.get(tablist); session.resume(); return session.pause;
    }
    const tabs=[...tablist.querySelectorAll('[data-experiment-tab]')];
    const panels=[...document.querySelectorAll('[data-experiment-panel]')];
    const initialized=new Map(),failed=new Set();
    const initializers={sampling,attention,rag,network};
    const stop=()=>{
      initialized.forEach(pause=>pause());
      document.dispatchEvent(new CustomEvent('lab:panel-change'));
    };
    function activate(id,focus=false) {
      if(!tabs.some(tab=>tab.dataset.experimentTab===id))id='gradient';
      stop();
      tabs.forEach(tab=>{
        const active=tab.dataset.experimentTab===id;
        tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
        if(active&&focus)tab.focus();
      });
      panels.forEach(panel=>{panel.hidden=panel.dataset.experimentPanel!==id;});
      // Tab navigation is independent of the numerical demos. Initialize each
      // panel only when opened, so one component cannot disable the other tabs.
      if(initializers[id]&&!initialized.has(id)&&!failed.has(id)) {
        const panel=panels.find(panel=>panel.dataset.experimentPanel===id);
        try {
          if(!M)throw new Error('LabMath was not loaded');
          initialized.set(id,initializers[id](panel));
        } catch(error) {
          failed.add(id);
          const notice=element('p','ai-empty','实验计算组件未能加载，请刷新页面后重试。');
          notice.setAttribute('role','alert');panel.querySelector('.lab-experiment-heading').append(notice);
          console.error('AI experiment initialization failed:',id,error);
        }
      }
      if(location.hash!=='#'+id)history.replaceState(null,'','#'+id);
    }
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>activate(tab.dataset.experimentTab));
      tab.addEventListener('keydown',event=>{
        const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
        const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:
          offset?(index+offset+tabs.length)%tabs.length:-1;
        if(target>=0){event.preventDefault();activate(tabs[target].dataset.experimentTab,true);}
      });
    });
    const visibility=()=>{if(document.hidden)stop();};
    const hash=()=>activate(location.hash.slice(1));
    let listening=false;
    const resume=()=>{
      if(!listening){document.addEventListener('visibilitychange',visibility);window.addEventListener('hashchange',hash);listening=true;}
      activate(location.hash.slice(1));
    };
    const pause=()=>{
      stop();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('hashchange',hash);listening=false;
    };
    sessions.set(tablist,{resume,pause});resume();return pause;
  };

  // Also boot independently of the blog's navigation script. This supports a
  // freshly deployed experiment page even if an older navigation script is cached.
  let pauseActive=()=>{};
  const boot=()=>{pauseActive();pauseActive=window.initAILabs();};
  document.addEventListener('pjax:send',()=>pauseActive());
  document.addEventListener('pjax:complete',boot);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

;
/* js/home-ai.js */
/* Local numerical diagrams for sampling, neural networks and attention. */
(() => {
  'use strict';
  const M=window.LabMath;
  const svg=(tag,attrs,value)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([name,v])=>node.setAttribute(name,v));if(value!==undefined)node.textContent=value;return node;};
  const text=(root,selector,value)=>{root.querySelector(selector).textContent=value;};
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sampling(root){
    const words=['好','冷','热','糟'],inputs=[...root.querySelectorAll('[data-home-logit]')];
    const temperature=root.querySelector('[data-home-sampling-temperature]'),topK=root.querySelector('[data-home-sampling-topk]'),play=root.querySelector('[data-home-sampling-play]');
    const diagram=root.querySelector('.home-diagram'),nodes=root.querySelector('[data-home-sampling-nodes]'),edges=root.querySelector('[data-home-sampling-edges]');
    const labels=[],paths=[];let probabilities=[],counts=words.map(()=>0),timer=null,enabled=!reduced(),active=false;
    words.forEach((word,index)=>{
      const y=52+index*72;
      nodes.append(svg('rect',{x:25,y:y-22,width:150,height:45,rx:10,class:'home-neuron'}),svg('text',{x:46,y:y+7},word));
      nodes.append(svg('text',{x:148,y:y+7,'text-anchor':'end','data-score':index}));
      edges.append(svg('path',{d:`M175 ${y} C235 ${y},235 160,280 160`,class:'home-flow-line'}));
      const line=svg('path',{d:`M350 160 C400 160,400 ${y},454 ${y}`,class:'home-flow-line'});edges.append(line);paths.push(line);
      nodes.append(svg('rect',{x:454,y:y-22,width:162,height:45,rx:10,class:'home-neuron'}));
      const label=svg('text',{x:535,y:y+7,'text-anchor':'middle'});nodes.append(label);labels.push(label);
    });
    nodes.append(svg('circle',{cx:315,cy:160,r:40,class:'home-neuron'}),svg('text',{x:315,y:166,'text-anchor':'middle'},'T'),svg('text',{x:315,y:224,'text-anchor':'middle',class:'home-svg-label'},'softmax'));
    function render(){
      probabilities=M.softmax(inputs.map(input=>Math.max(-10,Math.min(10,Number(input.value)||0))),Number(temperature.value),Number(topK.value));
      text(root,'[data-home-temperature-value]',Number(temperature.value).toFixed(1));text(root,'[data-home-topk-value]',topK.value);
      const total=counts.reduce((sum,count)=>sum+count,0);
      probabilities.forEach((p,index)=>{
        nodes.querySelector(`[data-score="${index}"]`).textContent=(Number(inputs[index].value)||0).toFixed(1);
        labels[index].textContent=(p*100).toFixed(1)+'%';paths[index].style.opacity=String(.15+p*.85);paths[index].style.strokeWidth=String(1+p*5);
        root.querySelector(`[data-home-sampling-prob="${index}"]`).style.width=p*100+'%';
        root.querySelector(`[data-home-sampling-frequency="${index}"]`).style.width=(total?counts[index]/total*100:0)+'%';
        text(root,`[data-home-sampling-label="${index}"]`,`${(p*100).toFixed(1)}% · ${counts[index]} 次`);
      });text(root,'[data-home-sampling-count]',total+' 次采样');
    }
    function sample(){
      const draw=Math.random();let sum=0,picked=probabilities.length-1;
      for(let i=0;i<probabilities.length;i++){sum+=probabilities[i];if(draw<sum){picked=i;break;}}
      counts[picked]++;const output=root.querySelector('[data-home-sampled]');output.textContent=words[picked];output.classList.remove('is-changing');
      requestAnimationFrame(()=>output.classList.add('is-changing'));
      root.querySelectorAll('[data-home-sampling-row]').forEach((node,index)=>node.classList.toggle('is-picked',index===picked));render();
    }
    const pause=()=>{clearInterval(timer);timer=null;diagram.classList.remove('is-running');};
    function resume(){pause();play.disabled=reduced();play.textContent=enabled?'暂停播放':'自动播放';play.setAttribute('aria-pressed',String(enabled));if(active&&enabled&&!document.hidden&&!reduced()){timer=setInterval(sample,1800);diagram.classList.add('is-running');}}
    play.addEventListener('click',()=>{enabled=!enabled;resume();});root.querySelector('[data-home-sampling-step]').addEventListener('click',sample);
    const reset=()=>{counts=words.map(()=>0);text(root,'[data-home-sampled]','…');render();};
    root.querySelector('[data-home-sampling-reset]').addEventListener('click',reset);[...inputs,temperature,topK].forEach(input=>input.addEventListener('input',reset));
    render();sample();return {pause,resume:()=>{active=true;resume();},deactivate:()=>{active=false;pause();}};
  }
  function network(root){
    const rate=root.querySelector('[data-home-network-rate]'),play=root.querySelector('[data-home-network-play]'),diagram=root.querySelector('.home-diagram');
    const edges=root.querySelector('[data-home-network-edges]'),nodes=root.querySelector('[data-home-network-nodes]'),inputY=[115,230],hiddenY=[45,125,205,285];
    const labels=[],circles=[],lines=[];let net=M.network(),selected=0,steps=0,frame=null,last=0;
    for(let j=0;j<4;j++)for(let k=0;k<2;k++){
      const line=svg('path',{d:`M95 ${inputY[k]} C190 ${inputY[k]},190 ${hiddenY[j]},285 ${hiddenY[j]}`,fill:'none',class:'home-network-line'});edges.append(line);lines.push({line,weight:()=>net.w[j][k]});
    }
    for(let j=0;j<4;j++){
      const line=svg('path',{d:`M340 ${hiddenY[j]} C430 ${hiddenY[j]},430 170,535 170`,fill:'none',class:'home-network-line'});edges.append(line);lines.push({line,weight:()=>net.v[j]});
    }
    for(const [x,y] of [[65,inputY[0]],[65,inputY[1]],...hiddenY.map(y=>[312,y]),[565,170]]){
      const circle=svg('circle',{cx:x,cy:y,r:29,class:'home-neuron'}),label=svg('text',{x,y:y+6,'text-anchor':'middle'});nodes.append(circle,label);circles.push(circle);labels.push(label);
    }
    nodes.append(svg('text',{x:65,y:315,'text-anchor':'middle',class:'home-svg-label'},'输入'),svg('text',{x:312,y:325,'text-anchor':'middle',class:'home-svg-label'},'tanh 隐藏层'),svg('text',{x:565,y:245,'text-anchor':'middle',class:'home-svg-label'},'p(1)'));
    const pause=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;play.textContent='开始训练';diagram.classList.remove('is-training');};
    function render(){
      const sample=M.datasets.xor[selected],result=M.forward(net,sample.x),metric=M.gradients(net,M.datasets.xor);
      [...sample.x,...result.hidden,result.output].forEach((value,index)=>{labels[index].textContent=value.toFixed(index<2?0:2);circles[index].style.fill=`color-mix(in srgb, ${value>=0?'#a59fcf':'#9cbcd8'} ${15+Math.abs(value)*30}%, var(--lab-surface))`;});
      lines.forEach(({line,weight})=>{const value=weight();line.style.stroke=value>=0?'#9382bd':'#7fabc9';line.style.strokeWidth=String(1+Math.min(5,Math.abs(value))*1.2);line.style.opacity=String(.35+Math.min(1,Math.abs(value))*.45);});
      text(root,'[data-home-network-rate-value]',Number(rate.value).toFixed(2));text(root,'[data-home-network-steps]',steps);text(root,'[data-home-network-loss]',metric.loss.toFixed(4));text(root,'[data-home-network-accuracy]',Math.round(metric.accuracy*100)+'%');
      text(root,'[data-home-network-prediction]',`输入 (${sample.x.join(', ')})，目标为 ${sample.y}，预测 p(1) = ${result.output.toFixed(3)}`);return metric;
    }
    function step(amount=100){M.train(net,M.datasets.xor,Number(rate.value),Math.min(amount,2000-steps));steps=Math.min(2000,steps+amount);const metric=render();return steps>=2000||(metric.loss<.018&&metric.accuracy===1);}
    root.querySelectorAll('[data-home-network-input]').forEach(button=>button.addEventListener('click',()=>{selected=Number(button.dataset.homeNetworkInput);root.querySelectorAll('[data-home-network-input]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));render();}));
    rate.addEventListener('input',render);root.querySelector('[data-home-network-step]').addEventListener('click',()=>{pause();step();});
    root.querySelector('[data-home-network-reset]').addEventListener('click',()=>{pause();net=M.network();steps=0;render();});
    play.addEventListener('click',()=>{
      if(frame!==null){pause();return;}if(steps>=2000){net=M.network();steps=0;}if(reduced()){while(!step()){}return;}
      play.textContent='暂停训练';diagram.classList.add('is-training');last=0;
      const tick=time=>{if(time-last>=100){last=time;if(step(20)){pause();return;}}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
    });render();return {pause,resume:()=>{},deactivate:pause};
  }
  function attention(root){
    const words=['我','在','学习','AI'],keys=[[1,0,0,0],[0,.8,.2,0],[0,.3,1,.4],[0,.1,.8,1]],queries=keys.map(row=>row.slice());
    const matrix=root.querySelector('[data-home-attention-matrix]'),mask=root.querySelector('[data-home-attention-mask]'),inputs=[...root.querySelectorAll('[data-home-query-dim]')];let selected=2;const cells=[];
    const label=value=>{const node=document.createElement('span');node.className='home-matrix-label';node.textContent=value;matrix.append(node);};label('Q / K');words.forEach(label);
    words.forEach((word,row)=>{label(word);words.forEach((_,column)=>{const cell=document.createElement('button');cell.type='button';cell.className='home-matrix-cell';matrix.append(cell);cells.push({cell,row,column});cell.addEventListener('click',()=>select(row));});});
    function render(){
      const weights=M.attention(queries,keys,mask.checked);
      cells.forEach(({cell,row,column})=>{const blocked=mask.checked&&column>row,value=weights[row][column];cell.textContent=blocked?'—':(value*100).toFixed(0)+'%';cell.style.backgroundColor=blocked?'var(--lab-soft)':`rgba(119,107,174,${.08+value*.65})`;cell.classList.toggle('is-selected',row===selected);cell.setAttribute('aria-label',`${words[row]}关注${words[column]}：${blocked?'已屏蔽':(value*100).toFixed(1)+'%'}`);});
      inputs.forEach((input,index)=>text(root,`[data-home-query-value="${index}"]`,queries[selected][index].toFixed(1)));
      root.querySelectorAll('[data-home-query]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.homeQuery)===selected)));
      text(root,'[data-home-attention-status]',`当前查询词：${words[selected]} · 可关注 ${mask.checked?selected+1:4} 个词`);
    }
    function select(index){selected=index;inputs.forEach((input,i)=>{input.value=queries[index][i];});render();}
    root.querySelectorAll('[data-home-query]').forEach(button=>button.addEventListener('click',()=>select(Number(button.dataset.homeQuery))));
    inputs.forEach((input,index)=>input.addEventListener('input',()=>{queries[selected][index]=Number(input.value);render();}));mask.addEventListener('change',render);select(selected);
    return {pause:()=>{},resume:()=>{},deactivate:()=>{}};
  }
  const sessions=new WeakMap();
  window.initHomeAI=()=>{
    const root=document.querySelector('[data-home-ai]');if(!root)return ()=>{};
    if(sessions.has(root)){const session=sessions.get(root);session.resume();return session.pause;}
    const models=new Map(),initializers={sampling,network,attention};let type='sampling',visible=true,listening=false;
    const pauseAll=()=>models.forEach(model=>model.deactivate());
    function refresh(){
      pauseAll();
      root.querySelectorAll('[data-home-type]').forEach(button=>{const active=button.dataset.homeType===type;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
      root.querySelectorAll('[data-home-visual]').forEach(panel=>{panel.hidden=panel.dataset.homeVisual!==type;});
      if(!models.has(type))models.set(type,initializers[type](root.querySelector(`[data-home-visual="${type}"]`)));
      if(visible&&!document.hidden)models.get(type).resume();
    }
    function bindTabs(selector,set){const buttons=[...root.querySelectorAll(selector)];buttons.forEach((button,index)=>{button.addEventListener('click',()=>set(button));button.addEventListener('keydown',event=>{const target=event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index-1+buttons.length)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:-1;if(target>=0){event.preventDefault();set(buttons[target]);buttons[target].focus();}});});}
    bindTabs('[data-home-type]',button=>{type=button.dataset.homeType;refresh();});
    const visibility=()=>{if(document.hidden)pauseAll();else refresh();};
    const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;pauseAll();if(visible&&!document.hidden&&models.has(type))models.get(type).resume();},{threshold:.05}):null;
    const resume=()=>{if(!listening){document.addEventListener('visibilitychange',visibility);observer?.observe(root);listening=true;}refresh();};
    const pause=()=>{pauseAll();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);listening=false;};
    sessions.set(root,{resume,pause});resume();return pause;
  };
})();

;
/* js/home-motion.js */
/* Lightweight homepage motion; computation widgets have separate lifecycles. */
(() => {
  'use strict';
  window.initHomeMotion=()=>{
    const home=document.querySelector('.lab-home');if(!home?.querySelector('.lab-hero'))return ()=>{};
    const media=matchMedia('(prefers-reduced-motion: reduce)'),cleanups=[];
    const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
    const ambient=document.createElement('div');ambient.className='home-ambient';ambient.setAttribute('aria-hidden','true');
    for(let index=0;index<9;index++){
      const petal=document.createElement('span');petal.className='home-petal';
      petal.style.setProperty('--petal-left',(index*12.7+3)%100+'%');petal.style.setProperty('--petal-duration',23+index%5*3+'s');
      petal.style.setProperty('--petal-delay',-index*4.3+'s');ambient.append(petal);
    }
    const progress=document.createElement('div');progress.className='home-scroll-progress';progress.setAttribute('aria-hidden','true');
    document.body.prepend(ambient,progress);let frame=null;
    const update=()=>{frame=null;const total=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${total>0?Math.min(1,scrollY/total):0})`;};
    listen(window,'scroll',()=>{if(frame===null)frame=requestAnimationFrame(update);},{passive:true});listen(window,'resize',update);update();
    const cards=home.querySelectorAll('.home-track-card,.lab-post-card');
    cards.forEach(card=>{
      listen(card,'pointermove',event=>{if(event.pointerType!=='mouse'||media.matches)return;const rect=card.getBoundingClientRect();card.style.setProperty('--pointer-x',event.clientX-rect.left+'px');card.style.setProperty('--pointer-y',event.clientY-rect.top+'px');card.classList.add('is-pointer-active');});
      listen(card,'pointerleave',()=>card.classList.remove('is-pointer-active'));
    });
    listen(document,'visibilitychange',()=>document.body.classList.toggle('home-motion-paused',document.hidden));
    return ()=>{cleanups.forEach(cleanup=>cleanup());cancelAnimationFrame(frame);ambient.remove();progress.remove();cards.forEach(card=>card.classList.remove('is-pointer-active'));document.body.classList.remove('home-motion-paused');};
  };
})();

;
/* js/starlab.js */
/* Browser-only enhancements. No account, backend or build-time dependency. */
(() => {
  'use strict';
  const progressKey = 'lsworld.reading.v1';
  let progress = {};
  let disposeExperiment = () => {};
  try {
    const stored = JSON.parse(localStorage.getItem(progressKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) progress = stored;
  } catch (_) { /* Reading progress still works in memory if storage is unavailable. */ }

  const persist = () => {
    try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch (_) { /* Optional persistence. */ }
  };

  function updateProgress() {
    document.querySelectorAll('[data-home-track]').forEach(card => {
      const nodes = JSON.parse(card.dataset.homeNodes || '[]');
      const count = nodes.filter(slug => progress[slug] === true).length;
      card.querySelector('[data-home-track-count]').textContent = `${count} / ${nodes.length}`;
      card.querySelector('[data-home-track-bar]').style.width = (nodes.length ? count / nodes.length * 100 : 0) + '%';
    });
    document.querySelectorAll('[data-read-node]').forEach(input => {
      input.checked = progress[input.dataset.readNode] === true;
      input.closest('.lab-node').classList.toggle('is-read', input.checked);
    });
    document.querySelectorAll('[data-route-progress]').forEach(output => {
      const inputs = output.closest('.lab-route').querySelectorAll('[data-read-node]');
      output.textContent = `${Array.from(inputs).filter(input => input.checked).length} / ${inputs.length} 已读`;
    });
  }

  function updateThemeLabel() {
    const button = document.querySelector('.lab-theme-toggle');
    if (!button) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
    button.title = dark ? '切换到浅色主题' : '切换到深色主题';
  }

  function setupNavigation() {
    if (!document.querySelector('.lab-skip-link')) {
      const skip = document.createElement('a');
      skip.className = 'lab-skip-link';
      skip.href = '#content-inner';
      skip.textContent = '跳到主要内容';
      document.body.prepend(skip);
    }
    for (const [selector, label] of [['#search-button > .search', '搜索文章'], ['#toggle-menu > .site-page', '展开导航菜单']]) {
      const control = document.querySelector(selector);
      if (!control || control.dataset.labAccessible) continue;
      control.dataset.labAccessible = 'true';
      // Native buttons support keyboard activation without imitating it on a span.
      // Keep Butterfly's existing listener target for the search implementation.
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'site-page lab-nav-control';
      button.setAttribute('aria-label', label);
      button.innerHTML = control.innerHTML;
      if (selector.startsWith('#search-button')) button.addEventListener('click', () => control.click());
      control.hidden = true;
      control.style.display = 'none';
      control.after(button);
    }
    const menus = document.querySelector('#nav #menus');
    if (menus && !menus.querySelector('.lab-theme-toggle')) {
      const toggle = document.createElement('button');
      toggle.className = 'lab-theme-toggle';
      toggle.type = 'button';
      toggle.addEventListener('click', () => {
        const nativeToggle = document.getElementById('darkmode');
        if (nativeToggle) nativeToggle.click();
        else {
          const mode = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
          document.documentElement.dataset.theme = mode;
          if (window.btf && window.btf.saveToLocal) window.btf.saveToLocal.set('theme', mode, 2);
        }
        updateThemeLabel();
      });
      menus.append(toggle);
    }
    document.querySelectorAll('#nav .menus_items a').forEach(link => {
      const target = new URL(link.href).pathname;
      const current = window.location.pathname;
      const active = target === '/' ? current === '/' : current.startsWith(target);
      link.classList.toggle('lab-nav-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    updateThemeLabel();
  }

  function setupExperiment(root) {
    if (window.setupGradientExperiment) return window.setupGradientExperiment(root);
    const rate = root.querySelector('#lab-learning-rate');
    const start = root.querySelector('#lab-start-weight');
    const runButton = root.querySelector('[data-lab-run]');
    let weight = Number(start.value);
    let history = [weight];
    let timer = null;
    const NS = 'http://www.w3.org/2000/svg';
    const create = (tag, attrs, text) => {
      const element = document.createElementNS(NS, tag);
      for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      runButton.textContent = '自动演示';
    };
    const number = value => Math.abs(value) >= 10000 ? value.toExponential(2) : value.toFixed(4);
    function draw() {
      const domain = Math.max(4.5, ...history.map(item => Math.abs(item))) * 1.04;
      const x = value => 60 + (value + domain) / (2 * domain) * 540;
      const y = value => 320 - value / (domain * domain) * 280;
      const grid = root.querySelector('[data-plot-grid]');
      grid.replaceChildren();
      for (let i = -2; i <= 2; i++) {
        const value = domain * i / 2;
        grid.append(create('line', {x1: x(value), x2: x(value), y1: 40, y2: 320, class: i === 0 ? 'lab-plot-axis' : 'lab-plot-grid'}));
        grid.append(create('text', {x: x(value), y: 342, 'text-anchor': 'middle', class: 'lab-tick'}, Math.abs(value) < .001 ? '0' : value.toFixed(1)));
      }
      for (let i = 0; i <= 4; i++) {
        const value = domain * domain * i / 4;
        grid.append(create('line', {x1: 60, x2: 600, y1: y(value), y2: y(value), class: i === 0 ? 'lab-plot-axis' : 'lab-plot-grid'}));
        grid.append(create('text', {x: 49, y: y(value) + 4, 'text-anchor': 'end', class: 'lab-tick'}, value >= 10000 ? value.toExponential(0) : value.toFixed(0)));
      }
      let path = '';
      for (let i = 0; i <= 120; i++) {
        const w = -domain + i / 120 * 2 * domain;
        path += `${i ? 'L' : 'M'}${x(w).toFixed(2)},${y(w * w).toFixed(2)} `;
      }
      root.querySelector('[data-plot-curve]').setAttribute('d', path);
      const steps = root.querySelector('[data-plot-steps]');
      steps.replaceChildren();
      steps.append(create('polyline', {points: history.map(w => `${x(w)},${y(w * w)}`).join(' '), class: 'lab-plot-path', fill: 'none'}));
      history.forEach((w, index) => steps.append(create('circle', {cx: x(w), cy: y(w * w), r: index === history.length - 1 ? 7 : 3.5, class: index === history.length - 1 ? 'lab-plot-point-current' : 'lab-plot-point'})));
    }
    function render() {
      const eta = Number(rate.value);
      root.querySelector('#lab-rate-value').textContent = eta.toFixed(2);
      root.querySelector('#lab-weight-value').textContent = Number(start.value).toFixed(1);
      root.querySelector('[data-lab-iteration]').textContent = history.length - 1;
      root.querySelector('[data-lab-weight]').textContent = number(weight);
      root.querySelector('[data-lab-loss]').textContent = number(weight * weight);
      let status = '等待实验';
      let explanation = '点击前进一步，观察参数沿着曲线向哪里移动。';
      if (Math.abs(weight) < .0001) {
        status = '已接近最小值'; explanation = '参数接近 0，损失也接近 0。可以换一个学习率再试一次。';
      } else if (history.length > 1) {
        if (eta < .5) { status = '平稳收敛'; explanation = '每次更新都向 0 靠近；学习率越小，需要的步数越多。'; }
        else if (eta < 1) { status = '震荡收敛'; explanation = '参数交替越过 0，但摆动幅度逐步缩小。'; }
        else if (eta === 1) { status = '等幅震荡'; explanation = '更新系数为 −1：参数在正负两侧来回切换，损失没有下降。'; }
        else { status = '正在发散'; explanation = '更新系数的绝对值超过 1：每步都离 0 更远。图表自动缩放显示轨迹。'; }
      }
      if (history.length > 40 && Math.abs(weight) >= .0001) explanation += ' 本次演示已达到 40 步，重置后可以继续探索。';
      root.querySelector('[data-lab-status]').textContent = status;
      root.querySelector('[data-lab-explanation]').textContent = explanation;
      draw();
    }
    const finished = () => history.length > 40 || Math.abs(weight) < .0001 || Math.abs(weight) > 1000;
    const step = () => {
      if (finished()) { stop(); return; }
      weight *= 1 - 2 * Number(rate.value);
      history.push(weight);
      render();
      if (finished()) stop();
    };
    const reset = () => { stop(); weight = Number(start.value); history = [weight]; render(); };
    rate.addEventListener('input', reset);
    start.addEventListener('input', reset);
    root.querySelector('[data-lab-step]').addEventListener('click', () => { stop(); step(); });
    root.querySelector('[data-lab-reset]').addEventListener('click', reset);
    runButton.addEventListener('click', () => {
      if (timer !== null) { stop(); return; }
      if (finished()) reset();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        while (!finished()) step();
        return;
      }
      runButton.textContent = '暂停演示';
      timer = window.setInterval(step, 550);
      step();
    });
    render();
    return stop;
  }

  function init() {
    disposeExperiment();
    setupNavigation();
    updateProgress();
    document.querySelectorAll('[data-reset-route]').forEach(button => {
      if (button.dataset.labBound) return;
      button.dataset.labBound = 'true';
      button.addEventListener('click', () => {
        button.closest('.lab-route').querySelectorAll('[data-read-node]').forEach(input => {
          delete progress[input.dataset.readNode];
        });
        persist();
        updateProgress();
      });
    });
    const experiment = document.querySelector('[data-gradient-lab]');
    const stopGradient = experiment ? setupExperiment(experiment) : () => {};
    const stopAI = window.initAILabs ? window.initAILabs() : () => {};
    const stopHome = window.initHomeMotion ? window.initHomeMotion() : () => {};
    const stopHomeAI = window.initHomeAI ? window.initHomeAI() : () => {};
    disposeExperiment = () => { stopGradient(); stopAI(); stopHome(); stopHomeAI(); };
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
      }, {threshold: 0.06});
      document.querySelectorAll('.lab-track-card, .home-track-card, .lab-post-card, .lab-project-card, .lab-section-heading').forEach((node,index) => {
        node.classList.add('ai-reveal'); node.style.setProperty('--reveal-delay', (index % 3) * 40 + 'ms'); observer.observe(node);
      });
      const previous = disposeExperiment;
      disposeExperiment = () => { previous(); observer.disconnect(); };
    }
  }
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-read-node]')) return;
    progress[event.target.dataset.readNode] = event.target.checked;
    persist(); updateProgress();
  });
  window.addEventListener('storage', event => {
    if (event.key !== progressKey) return;
    try {
      const stored = JSON.parse(event.newValue || '{}');
      progress = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    } catch (_) { progress = {}; }
    updateProgress();
  });
  new MutationObserver(updateThemeLabel).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  document.addEventListener('pjax:send', () => disposeExperiment());
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();

;
/* js/companion.js */
/* The renderer uses a six-frame reference sheet. It can later be replaced by Live2D. */
(() => {
  'use strict';
  if (window.__lsworldCompanion) return;
  window.__lsworldCompanion = true;
  const storageKey = 'lsworld.companion.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { /* Optional browser persistence. */ }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  let token = typeof saved.token === 'string' ? saved.token : '';
  let root, config, apiBase, notice, messageList, quota, textarea, send, form;
  let opened = false, busy = false, service = null, currentLimits = null, audio = null, audioContext = null, analyser = null;
  let animationFrame = null, blinkTimer = null, blinking = false, mouth = 0, sessionPromise = null, playbackTicket = 0;
  const audioCache = new Map();
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify({token})); } catch (_) {} };
  const node = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text != null) result.textContent = text;
    return result;
  };
  const button = (label, className, action) => {
    const result = node('button', className, label); result.type = 'button';
    if (action) result.addEventListener('click', action); return result;
  };
  const report = text => { notice.textContent = text; notice.hidden = !text; };
  const state = text => { root.querySelector('.cp-state').textContent = text; };
  const setFrame = () => root.querySelectorAll('.cp-avatar').forEach(avatar => {
    avatar.style.backgroundPosition = `${mouth * 50}% ${blinking ? 100 : 0}%`;
  });
  const scheduleBlink = () => {
    clearTimeout(blinkTimer);
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    blinkTimer = setTimeout(() => { blinking = true; setFrame(); blinkTimer = setTimeout(() => { blinking = false; setFrame(); scheduleBlink(); }, 140); }, 3000 + Math.random() * 3500);
  };
  function updateLimits(limits) {
    if (limits) currentLimits = limits;
    quota.textContent = currentLimits ? `今日可聊 ${Math.min(currentLimits.chatRemaining, currentLimits.voiceRemaining)} 次` : '每日限次体验';
    quota.title = '每次回复自动朗读，每人每天最多 10 次；全站还有共享额度。';
    updateSend();
  }
  function updateSend() {
    if (!send) return;
    const exhausted = currentLimits && (!currentLimits.chatAvailable || !currentLimits.voiceAvailable || Math.min(currentLimits.chatRemaining, currentLimits.voiceRemaining) <= 0);
    send.disabled = busy || !service?.chat || (!service.demo && (!service.voice || exhausted));
  }
  async function request(path, method = 'GET', data, authenticated = true, raw = false) {
    if (!apiBase) throw new Error('助手正在准备连接，稍后再来找我吧。');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(apiBase + path, {method, headers: {...(data ? {'Content-Type': 'application/json'} : {}),
        ...(authenticated && token ? {'Authorization': 'Bearer ' + token} : {})}, body: data ? JSON.stringify(data) : undefined, signal: controller.signal});
      if (!response.ok) {
        if (response.status === 401) { token = ''; persist(); sessionPromise = null; }
        let result; try { result = await response.json(); } catch (_) {}
        throw new Error(result?.error || '连接暂时没成功，稍后再试试吧。');
      }
      return raw ? await response.blob() : await response.json();
    } catch (error) { if (error.name === 'AbortError') throw new Error('这次等待有点久，稍后查看一下回复吧。'); throw error; }
    finally { clearTimeout(timer); }
  }
  async function ensureSession() {
    if (token) return;
    if (!sessionPromise) sessionPromise = request('/session', 'POST', {}, false).then(result => {
      token = result.token; persist(); updateLimits(result.limits);
    }).finally(() => { sessionPromise = null; });
    await sessionPromise;
  }
  function setOpen(value) {
    opened = value; root.querySelector('.cp-panel').hidden = !value;
    root.querySelector('.cp-launcher').hidden = value;
    root.querySelector('.cp-launcher').setAttribute('aria-expanded', String(value));
    if (value) { refresh(); textarea.focus(); }
    else { stopAudio(); root.querySelector('.cp-launcher').focus(); }
  }
  async function refresh() {
    try {
      service = await request('/health', 'GET', null, false);
      state(service.demo ? '本地演示 · 未调用模型' : service.chat ? '在这里，听你说' : '正在准备连接');
      updateSend();
      if (service.demo) report('本地演示：回复用于验证界面，没有调用真实聊天模型。');
      else if (!service.chat) report('聊天服务正在准备连接。');
      else report('');
      if (token) {
        const result = await request('/state'); updateLimits(result.limits);
        if (!busy) { messageList.replaceChildren(); if (!result.messages.length) welcome(); result.messages.forEach(addMessage); }
      }
    } catch (error) { updateSend(); report(error.message); }
  }
  function welcome() { addMessage({role: 'assistant', text: config.greeting}); }
  function addMessage(message) {
    const item = node('div', 'cp-message'); item.dataset.role = message.role;
    item.append(node('p', '', message.text));
    if (message.sources?.length) {
      const links = node('div', 'cp-sources');
      message.sources.forEach(source => {
        try {
          const url = new URL(source.url); if (!['http:','https:'].includes(url.protocol)) return;
          const link = node('a', '', '↗ ' + source.title); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
        } catch (_) {}
      });
      item.append(links);
    }
    messageList.append(item); messageList.scrollTop = messageList.scrollHeight;
  }
  async function submit(event) {
    event.preventDefault(); const text = textarea.value.trim(); if (!text || busy) return;
    if (send.disabled) return;
    busy = true; send.disabled = true; textarea.disabled = true; stopAudio(); state('想一想怎么回答你');
    primeAudio();
    try {
      await ensureSession(); addMessage({role: 'user', text}); textarea.value = '';
      const result = await request('/chat', 'POST', {text, requestId: crypto.randomUUID(), autoSpeak: true});
      addMessage(result); updateLimits(result.limits); blinking = result.emotion === 'happy'; setFrame();
      setTimeout(() => { blinking = false; setFrame(); }, 350);
      report(result.demo ? '本地演示：没有调用真实聊天模型。' : ''); state('在这里，听你说');
      if (!result.demo && opened && !document.hidden) {
        try { await playSpeech(result); }
        catch (error) { report(error.name === 'NotAllowedError' ? '浏览器阻止了自动播放，请允许此网站播放声音后再发送消息。' : error.message); state('文字已回复，语音暂时没成功'); }
      }
    } catch (error) { report(error.message); textarea.value = text; state('稍后再试试吧'); }
    finally { busy = false; updateSend(); textarea.disabled = false; textarea.focus(); }
  }
  function stopAudio() {
    playbackTicket++;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null;
    mouth = 0; if (root) { root.classList.remove('cp-playing'); root.querySelector('.cp-stop').hidden = true; setFrame(); }
  }
  function animateMouth() {
    if (!audio || audio.paused || document.hidden) return;
    if (analyser) {
      const values = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(values);
      let energy = 0; for (const value of values) energy += ((value - 128) / 128) ** 2;
      const rms = Math.sqrt(energy / values.length); mouth = rms > .12 ? 2 : rms > .025 ? 1 : 0;
    } else mouth = 0;
    setFrame(); animationFrame = requestAnimationFrame(animateMouth);
  }
  function applyAudioSettings() {
    if (!audio) return;
    audio.playbackRate = 1;
    audio.preservesPitch = true;
  }
  function prepareAudio() {
    if (audio) return;
    audio = new Audio(); audio.preload = 'auto';
    audio.addEventListener('ended', () => { if (root.classList.contains('cp-playing')) { stopAudio(); state('在这里，听你说'); } });
    audio.addEventListener('error', () => { if (root.classList.contains('cp-playing')) { stopAudio(); report('音频播放失败，文字回复已经保留。'); } });
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context) {
      try { audioContext = new Context(); analyser = audioContext.createAnalyser(); analyser.fftSize = 256;
        const source = audioContext.createMediaElementSource(audio); source.connect(analyser); analyser.connect(audioContext.destination);
      } catch (_) { analyser = null; }
    }
  }
  function primeAudio() {
    // Unlock the same audio element/context synchronously during the Send gesture.
    prepareAudio();
    audioContext?.resume().catch(() => {});
    const silence = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';
    audio.src = silence;
    audio.play().then(() => { if (audio.src === silence) audio.pause(); }).catch(() => {});
  }
  async function playSpeech(message) {
    if (!service?.voice) throw new Error('女声服务还没有连接好，文字聊天可以继续使用。');
    stopAudio(); const ticket = playbackTicket; state('准备把这句话说给你听'); report('');
    const cacheKey = message.id;
    let cached = audioCache.get(cacheKey);
    if (!cached) {
      const result = await request('/speech', 'POST', {messageId: message.id}); updateLimits(result.limits);
      const blob = await request('/audio/' + result.audioId, 'GET', null, true, true);
      cached = URL.createObjectURL(blob); audioCache.set(cacheKey, cached);
      if (audioCache.size > 10) { const oldest = audioCache.keys().next().value; URL.revokeObjectURL(audioCache.get(oldest)); audioCache.delete(oldest); }
    }
    if (ticket !== playbackTicket || !opened || document.hidden) return;
    prepareAudio();
    audio.src = cached; applyAudioSettings();
    if (audioContext?.state === 'suspended') await audioContext.resume();
    if (ticket !== playbackTicket || !opened || document.hidden) return;
    await audio.play();
    if (ticket !== playbackTicket || !opened || document.hidden) { stopAudio(); return; }
    root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
    state('说给你听'); animateMouth();
  }
  function build() {
    root = node('aside', 'companion'); root.setAttribute('aria-label', config.name + '陪伴助手');
    const avatar = () => { const el = node('div', 'cp-avatar'); el.setAttribute('aria-hidden', 'true'); el.style.backgroundImage = 'url(' + JSON.stringify(new URL(config.avatar, location.origin).href) + ')'; return el; };
    const launcher = button('', 'cp-launcher', () => setOpen(true)); launcher.setAttribute('aria-label', '与' + config.name + '聊天'); launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'companion-panel'); launcher.append(avatar(), node('span', 'cp-launcher-label', config.name + ' · 说说话'));
    const panel = node('section', 'cp-panel'); panel.id = 'companion-panel'; panel.hidden = true; panel.setAttribute('aria-label', '聊天面板');
    const header = node('header', 'cp-header'); const title = node('div', 'cp-title', config.name); title.append(node('small', '', '你的博客伙伴'));
    const close = button('×', 'cp-icon', () => setOpen(false)); close.setAttribute('aria-label', '关闭聊天'); header.append(title, close);
    const intro = node('div', 'cp-intro'); const copy = node('div', 'cp-intro-copy'); copy.append(node('strong', '', '留一点时间，聊聊今天。'), node('p', '', '聊近况，也陪你一起学习。'), node('span', 'cp-state', '在这里，听你说'));
    const stop = button('停止播放', 'cp-stop', () => { stopAudio(); state('在这里，听你说'); }); stop.hidden = true; copy.append(stop); intro.append(avatar(), copy);
    const nav = node('div', 'cp-nav'); nav.append(node('span', 'cp-chip', '文字 + 自动语音'));
    quota = node('span', 'cp-quota'); nav.append(quota);
    messageList = node('div', 'cp-messages'); messageList.dataset.cpView = 'chat'; messageList.setAttribute('role', 'log'); messageList.setAttribute('aria-live', 'polite'); messageList.setAttribute('aria-label', '聊天记录');
    const dataButtons = node('div', 'cp-data-buttons');
    dataButtons.append(button('导出我的数据', '', async () => {
      try { await ensureSession(); const data = await request('/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
        const a = node('a'); a.href = url; a.download = 'companion-memory.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { report(error.message); }
    }), button('清空对话', '', async () => {
      if (!window.confirm('清空这个浏览器的对话和相关保存数据？')) return;
      try { await ensureSession(); const result = await request('/reset', 'DELETE'); messageList.replaceChildren(); welcome();
        audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); stopAudio(); updateLimits(result.limits); report('对话已清空，今天的体验次数继续保留。');
      } catch (error) { report(error.message); }
    }));
    notice = node('p', 'cp-notice'); notice.hidden = true; notice.setAttribute('role', 'status');
    form = node('form', 'cp-form'); textarea = node('textarea'); textarea.maxLength = 600; textarea.rows = 2; textarea.placeholder = '今天有什么想说的？'; textarea.setAttribute('aria-label', '聊天消息');
    send = node('button', 'cp-primary', '发送'); send.type = 'submit'; form.append(textarea, send); form.addEventListener('submit', submit);
    textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    const disclosure = node('p', 'cp-disclosure', '发送后回复会自动朗读；对话会用于模型和语音服务。');
    panel.append(header, intro, nav, messageList, notice, form, disclosure, dataButtons); root.append(launcher, panel); document.body.append(root);
    welcome(); updateLimits(); scheduleBlink();
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && opened) setOpen(false); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAudio(); clearTimeout(blinkTimer); blinking = false; setFrame(); } else scheduleBlink(); });
    document.addEventListener('pjax:send', () => { stopAudio(); });
    document.addEventListener('pjax:complete', () => { if (!root.isConnected) document.body.append(root); scheduleBlink(); });
    window.addEventListener('pagehide', () => { stopAudio(); clearTimeout(blinkTimer); audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); });
    window.addEventListener('pageshow', scheduleBlink);
  }
  async function boot() {
    try {
      const response = await fetch('/companion-config.json', {cache: 'no-cache'}); if (!response.ok) return;
      config = await response.json(); if (!config.enabled) return;
      apiBase = String(config.apiBase || '').replace(/\/$/, '');
      if (['localhost','127.0.0.1'].includes(location.hostname)) apiBase = 'http://127.0.0.1:8787';
      if (apiBase && !/^https?:\/\//.test(apiBase)) apiBase = '';
      build();
    } catch (_) { /* An unavailable assistant cannot break article navigation. */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
})();
