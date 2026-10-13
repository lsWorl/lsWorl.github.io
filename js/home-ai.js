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
