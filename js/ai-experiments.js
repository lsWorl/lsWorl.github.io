/* Local interactive examples. No remote model or third-party runtime required. */
(() => {
  'use strict';
  let M = window.LabMath;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const teaching=(root,type,commit,pause)=>window.LabLearning?window.LabLearning.mount(root,type,commit,pause):{update(){},stop(){}};
  const seedValue=input=>Math.max(0,Math.min(999999,Math.trunc(Number(input.value)||0)));
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
    const seed=root.querySelector('#sampling-seed');
    const button=root.querySelector('[data-sample-run]');
    let counts=words.map(()=>0), probabilities=[], frame=null, batch=0, last=0;
    let rng=M.random(seedValue(seed)),draw=rng();
    const lesson=teaching(root,'sampling',()=>{stop();sample();},()=>stop());
    const stop=()=>{lesson.stop();if(frame!==null) cancelAnimationFrame(frame);frame=null;button.textContent='采样 100 次';};
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
      lesson.update({logits:logits.map(input=>Number(input.value)||0),temperature:Number(temperature.value),topK:Number(topK.value),draw,total});
    }
    function sample() {
      const trace=M.sampleTrace(logits.map(input=>Number(input.value)||0),Number(temperature.value),Number(topK.value),draw),index=trace.selected;
      draw=rng();
      counts[index]++;
      const output=root.querySelector('[data-sampled-token]');
      output.textContent=words[index];
      root.querySelectorAll('[data-token-row]').forEach((row,i)=>row.classList.toggle('is-sampled',i===index));
      render();
    }
    const reset=()=>{stop();rng=M.random(seedValue(seed));draw=rng();counts=words.map(()=>0);root.querySelector('[data-sampled-token]').textContent='…';root.querySelectorAll('[data-token-row]').forEach(row=>row.classList.remove('is-sampled'));render();};
    [...logits,temperature,topK,seed].forEach(input=>input.addEventListener('input',reset));
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
    const values=[[1,0],[0,1],[1,1],[-1,.5]];
    let selected=2;
    const grid=root.querySelector('[data-attention-grid]');
    const mask=root.querySelector('[data-causal-mask]');
    const inputs=[...root.querySelectorAll('[data-query-dimension]')];
    const cells=[];
    const lesson=teaching(root,'attention');
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
      const trace=M.attentionTrace(queries[selected],keys,values,selected,mask.checked);
      root.querySelector('[data-attention-output]').textContent='['+trace.output.map(v=>v.toFixed(4)).join(', ')+']';
      lesson.update({queries,keys,values,selected,causal:mask.checked});
    }
    function select(index) {selected=index;inputs.forEach((input,i)=>{input.value=queries[index][i];});render();}
    root.querySelectorAll('[data-query-token]').forEach((button,index)=>button.addEventListener('click',()=>select(index)));
    inputs.forEach((input,index)=>input.addEventListener('input',()=>{queries[selected][index]=Number(input.value);render();}));
    mask.addEventListener('change',render);
    select(selected);return ()=>lesson.stop();
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
    const lesson=teaching(root,'rag',null,()=>stop());
    const stop=()=>{lesson.stop();if(frame!==null)cancelAnimationFrame(frame);frame=null;button.textContent='演示流程';};
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
      lesson.update({query:query.value,documents,topK:Number(topK.value),budget:Number(budget.value)});
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
    const seed=root.querySelector('#network-seed'),sample=root.querySelector('#network-inspect-sample'),neuron=root.querySelector('#network-inspect-neuron');
    let net=M.network(),dataset='xor',epoch=0,losses=[],frame=null,last=0;
    const lesson=teaching(root,'network',()=>{stop();step(1);},()=>stop());
    const grid=[];
    for(let row=0;row<24;row++)for(let col=0;col<24;col++) {
      const cell=svg('rect',{x:50+col*15,y:20+row*11.25,width:15.3,height:11.55});
      cells.append(cell);grid.push({cell,x:[-1.5+(col+.5)/24*3,1.5-(row+.5)/24*3]});
    }
    const stop=()=>{lesson.stop();if(frame!==null)cancelAnimationFrame(frame);frame=null;run.textContent='开始训练';};
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
      lesson.update({net,dataset,rate:Number(rate.value),sample:Number(sample.value),neuron:Number(neuron.value),epoch,canCommit:epoch<3000});
      return metric;
    }
    function step(count=50) {
      const amount=Math.min(count,3000-epoch);if(amount<=0)return true;
      M.train(net,M.datasets[dataset],Number(rate.value),amount);epoch+=amount;
      const metric=M.gradients(net,M.datasets[dataset]);losses.push({epoch,loss:metric.loss});render();
      return epoch>=3000 || (metric.loss<.018&&metric.accuracy===1);
    }
    function reset() {stop();net=M.network(seedValue(seed));epoch=0;losses=[{epoch:0,loss:M.gradients(net,M.datasets[dataset]).loss}];render();}
    root.querySelectorAll('[data-network-dataset]').forEach(button=>button.addEventListener('click',()=>{
      dataset=button.dataset.networkDataset;root.querySelectorAll('[data-network-dataset]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));reset();
    }));
    rate.addEventListener('input',render);
    seed.addEventListener('input',reset);
    [sample,neuron].forEach(input=>input.addEventListener('change',()=>{stop();render();}));
    root.querySelector('[data-network-reset]').addEventListener('click',reset);
    root.querySelector('[data-network-step]').addEventListener('click',()=>{stop();step();});
    root.querySelector('[data-network-step-once]').addEventListener('click',()=>{stop();step(1);});
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

  const gradientSessions=new WeakMap();
  window.setupGradientExperiment=root=>{
    if(gradientSessions.has(root)) {
      const session=gradientSessions.get(root);session.resume();return session.pause;
    }
    const rate=root.querySelector('#lab-learning-rate'),initial=root.querySelector('#lab-start-weight'),speed=root.querySelector('#lab-playback-speed');
    const button=root.querySelector('[data-lab-run]');
    let weight=Number(initial.value),history=[weight],frame=null,animation=null,playing=false;
    const lesson=teaching(root,'gradient',()=>{stop();step();},()=>stop());
    const stop=()=>{lesson.stop();if(frame!==null)cancelAnimationFrame(frame);frame=null;animation=null;playing=false;button.textContent='连续播放';draw(weight);};
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
      lesson.update({weight,rate:eta,initial:Number(initial.value),iteration:history.length-1,canCommit:!finished()});
    }
    function begin(time) {
      if(finished()){stop();return;}
      const from=weight;weight=M.gradientTrace(weight,Number(rate.value)).next;history.push(weight);
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
      if(reduced()){weight=M.gradientTrace(weight,Number(rate.value)).next;history.push(weight);render();draw();return;}
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
    const resume=()=>document.addEventListener('lab:panel-change',stop);
    const pause=()=>{stop();document.removeEventListener('lab:panel-change',stop);};
    gradientSessions.set(root,{resume,pause});resume();reset();return pause;
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
