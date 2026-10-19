/* Teaching views consume the same numerical traces as the experiments. */
(() => {
  'use strict';
  const M=window.LabMath;
  const n=value=>value===-Infinity?'−∞':Number.isFinite(value)?(Math.abs(value)>1e5?value.toExponential(3):value.toFixed(4)):'—';
  const vector=values=>'['+values.map(n).join(', ')+']';
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const step=(title,formula,explanation,rows,code,visual)=>({title,formula,explanation,rows,code,visual});
  const words=['好','冷','热','糟','猫'],tokens=['我','在','学习','AI'];
  const bar=(labels,values)=>({kind:'bars',labels,values});
  const lessons={
    gradient(d) {
      const t=M.gradientTrace(d.weight,d.rate),rows=[['当前参数','w',n(t.weight)],['当前损失',n(t.weight)+'²',n(t.loss)]];
      const visual={kind:'gradient',...t};
      return {title:'跟完一次参数更新',intro:'从当前参数出发，逐项计算下一步。浏览步骤不会更新参数；最后可执行这次更新。',
        steps:[
          step('读取参数','L(w) = w²','损失衡量当前位置离最低点有多远。先预测下一步损失会怎样变化。',rows,'loss = w * w',{...visual,phase:0}),
          step('求梯度','g = dL/dw = 2w','切线斜率是梯度。梯度为正时，沿负梯度方向向左；为负时向右。',[['梯度','2 × '+n(t.weight),n(t.gradient)]],'gradient = 2 * w',{...visual,phase:1}),
          step('计算更新量','Δ = ηg','学习率控制沿负梯度方向走多远，更新时要减去这个带符号的量。',[['学习率','η',n(t.rate)],['更新量',n(t.rate)+' × '+n(t.gradient),n(t.change)]],'change = rate * gradient',{...visual,phase:2}),
          step('更新并验证','w′ = w − Δ; L′ = (w′)²','观察连线的终点。跨过最低点后，损失仍可能降低；步子太大则可能升高。',[
            ['新参数',n(t.weight)+' − ('+n(t.change)+')',n(t.next)],['新损失',n(t.next)+'²',n(t.nextLoss)],['损失变化','L′ − L',n(t.nextLoss-t.loss)]],
          'next = w - rate * gradient\nnextLoss = next * next',{...visual,phase:3})],
        question:{prompt:'按当前学习率执行一次更新，损失会怎样？',options:['降低','不变','升高'],answer:Math.abs(t.nextLoss-t.loss)<1e-12?1:t.nextLoss<t.loss?0:2,explanation:`本次损失从 ${n(t.loss)} 变为 ${n(t.nextLoss)}。判断依据是实际的新旧损失。`},
        challenge:'调整初始参数为非零值，找到让参数一步到达 0 的学习率，并执行一次更新。',
        check:{ok:d.iteration===1&&d.initial!==0&&Math.abs(d.weight)<1e-10,text:d.iteration===1&&d.initial!==0&&Math.abs(d.weight)<1e-10?'完成！η = 0.5 时，w′ = (1 − 2η)w = 0。':'先重置到非零初始参数，再调整学习率；目标是恰好更新一步后到达 0。'},commit:'执行这次更新'};
    },
    sampling(d) {
      const t=M.sampleTrace(d.logits,d.temperature,d.topK,d.draw);
      const intervals={kind:'intervals',...t};
      return {title:'看清一个词如何被采到',intro:'这里预演下一次采样。固定种子和参数后，随机数序列可以复现；浏览步骤不会消耗随机数。',steps:[
        step('缩放分数','sᵢ = logitᵢ / T','温度缩放候选分数。低温放大分数间的差距。',words.map((w,i)=>[w,n(d.logits[i])+' / '+n(d.temperature),n(t.scaled[i])]),'scaled = logits.map(value => value / temperature)',bar(words,t.scaled)),
        step('筛选候选','保留分数最高的 K 项','被 Top-K 移除的词概率为 0。并列时按原候选顺序选择，保证可复现。',words.map((w,i)=>[w,'Top-'+d.topK,t.eligible.includes(i)?'保留':'移除']),'eligible = sortDescending(logits).slice(0, topK)',bar(words,t.probabilities)),
        step('归一化概率','pᵢ = exp((logitᵢ − max) / T) / Σ exp','减去最大分数可以避免指数溢出，归一化后的概率不变。',words.map((w,i)=>[w,'指数权重 '+n(t.weights[i]),n(t.probabilities[i])]),'weight = exp((logit - max) / temperature)\np = weight / total',bar(words,t.probabilities)),
        step('用随机数选词','取 r 所落入的累计概率区间','区间左闭右开。只有点击执行才会记录本次采样，并准备下一个随机数。',words.map((w,i)=>[w,`[${n(t.intervals[i].start)}, ${n(t.intervals[i].end)})`,t.selected===i?'← r = '+n(t.draw):'']),
          'r = random()\nselected = firstIndex(cumulativeProbability > r)',intervals)],
        question:{prompt:'Top-K = 1 时，多次采样能得到几个不同候选词？',options:['最多一个','仍可得到所有词'],answer:0,explanation:'只保留一个候选时，它的概率为 1；温度和随机数都不会让已移除的词重新出现。'},
        challenge:'把 Top-K 调到 1，再采样一次，验证只有一个候选的概率非零。',check:{ok:d.topK===1&&d.total>0,text:d.topK===1&&d.total>0?'完成！保留的候选概率为 1，其他候选为 0。':'调整 Top-K 后统计会重置，接着点击“采样一次”或执行预演。'},commit:'执行这次采样'};
    },
    attention(d) {
      const t=M.attentionTrace(d.queries[d.selected],d.keys,d.values,d.selected,d.causal);
      return {title:'从 Q / K 一直算到输出',intro:'Q 决定寻找什么，K 用于匹配，V 提供被加权的信息。这里使用手工向量演示完整计算。',steps:[
        step('逐项乘加','scoreⱼ = Q · Kⱼ','当前 Q = '+vector(t.query)+'。同一维先相乘，再把各维结果加起来。选择其他查询词会重新计算本行。',tokens.map((w,i)=>[w,t.query.map((q,j)=>n(q)+' × '+n(t.keys[i][j])).join(' + '),n(t.scores[i])]),'score = query.reduce((sum, q, i) => sum + q * key[i], 0)',bar(tokens,t.scores)),
        step('缩放分数','sⱼ = scoreⱼ / √d; d = 4','这里除以 √4 = 2，以控制点积随维度增大带来的尺度变化。',tokens.map((w,i)=>[w,n(t.scores[i])+' / 2',n(t.scaled[i])]),'scaled = score / Math.sqrt(query.length)',bar(tokens,t.scaled)),
        step('应用遮罩','未来位置 → −∞','因果遮罩禁止当前词读取未来位置；−∞ 在 Softmax 后对应概率 0。',tokens.map((w,i)=>[w,'位置 '+(i+1),n(t.masked[i])]),'masked = causal && column > row ? -Infinity : scaled',bar(tokens,t.masked.map(v=>Number.isFinite(v)?v:0))),
        step('得到权重','A = softmax(maskedScores)','未屏蔽位置之间重新归一化。注意力权重表示这次运算的混合比例。',tokens.map((w,i)=>[w,n(t.masked[i]),n(t.probabilities[i])]),'attention = softmax(maskedScores)',bar(tokens,t.probabilities)),
        step('加权读取 V','output = Σ Aⱼ Vⱼ','权重乘以每个 V，再逐维相加，得到输出向量。V 是独立的示例向量，权重本身还不是输出。',[
          ...tokens.map((w,i)=>[w,n(t.probabilities[i])+' × '+vector(t.values[i]),vector(t.contributions[i])]),['输出','逐维求和',vector(t.output)]],
          'output = values[0].map((_, j) =>\n  values.reduce((sum, v, i) => sum + attention[i] * v[j], 0))',bar(['输出维度 1','输出维度 2'],t.output))],
        question:{prompt:'打开因果遮罩，第一个词能够读取哪些位置？',options:['只能读取自己','可以读取全部词'],answer:0,explanation:'第一行只保留第一个位置，Softmax 后权重为 [1, 0, 0, 0]，输出等于第一个 V。'},
        challenge:'选择“我”并开启因果遮罩，验证它的输出等于自身 V。',check:{ok:d.selected===0&&d.causal,text:d.selected===0&&d.causal?'完成！第一个词权重为 1，输出等于 V₁ = '+vector(d.values[0])+'。':'用上方查询词按钮选择“我”，并勾选因果遮罩。'}};
    },
    rag(d) {
      const t=M.retrievalTrace(d.query,d.documents,d.topK),context=M.contextFor(t.found,d.budget);
      const active=t.vocabulary.map((term,i)=>({term,i})).filter(({i})=>t.queryCounts[i]>0);
      const docRows=d.documents.map((doc,i)=>[doc.title,
        `点积 ${n(M.dot(t.queryVector,t.vectors[i]))} / (${n(Math.sqrt(M.dot(t.queryVector,t.queryVector)))} × ${n(Math.sqrt(M.dot(t.vectors[i],t.vectors[i])))})\n文档向量 ${vector(t.vectors[i])}`,
        n(M.cosine(t.queryVector,t.vectors[i]))]);
      return {title:'追踪证据如何进入上下文',intro:'固定关键词 TF-IDF 演示。没有调用 Embedding 模型或生成模型；未收录的同义词可能无法匹配。',steps:[
        step('识别关键词','TF = 关键词出现次数','查询和文档使用同一词表。中文按子串计数，英文按完整词匹配；空查询或无命中会得到零向量。',active.length?active.map(({term,i})=>[term,'查询词频',String(t.queryCounts[i])]):[['无命中','查询为零向量','相似度全部为 0']],
          'queryCounts = counts(query)',bar(active.map(v=>v.term),active.map(v=>t.queryCounts[v.i]))),
        step('构造 TF-IDF','IDF = ln((1 + N)/(1 + DF)) + 1','较少文档包含的关键词有更高 IDF。文档向量同时统计标题与正文，所有向量共用这套词表顺序。',active.length?active.map(({term,i})=>[term,'TF '+t.queryCounts[i]+' × IDF '+n(t.idf[i]),n(t.queryVector[i])]):[['无关键词','没有非零向量分量','0']],
          'idf = log((1 + documentCount) / (1 + documentFrequency)) + 1\nvector = termCounts.map((tf, i) => tf * idf[i])',bar(active.map(v=>v.term),active.map(v=>t.queryVector[v.i]))),
        step('相似度与排序','cos(q, d) = (q · d) / (‖q‖ ‖d‖)','下表向量维度依次为：'+t.vocabulary.join('、')+'。只保留相似度大于 0 的前 K 篇。',docRows,
          'score = dot(query, doc) / (norm(query) * norm(doc))\nfound = ranked.filter(doc => doc.score > 0).slice(0, topK)',bar(t.ranked.map(v=>v.title),t.ranked.map(v=>v.score))),
        step('按预算组装','依次取正文，直到字符预算耗尽','预算只统计正文的 Unicode 字符，不含标题、来源标记与提示词，也不等于模型 token 数。',t.ranked.map(doc=>{
          const chosen=t.found.some(v=>v.id===doc.id),part=context.find(v=>v.id===doc.id);
          return [doc.title,'相似度 '+n(doc.score),part?`${Array.from(part.excerpt).length} 字符${part.truncated?' · 已截断':''}`:chosen?'已检索 · 预算不足':doc.score>0?'未进入 Top-K':'关键词无交集'];
        }),'context = contextFor(found, characterBudget)',bar(context.map(v=>v.title),context.map(v=>Array.from(v.excerpt).length)))],
        question:{prompt:'把 Top-K 调大后，所有检索到的正文一定完整进入上下文吗？',options:['不一定，还受预算限制','一定会完整进入'],answer:0,explanation:'Top-K 控制检索篇数，字符预算控制实际放入的正文长度，后面的文档可能被截断或完全放不下。'},
        challenge:'保留有匹配的查询，将预算调到 80 字符以内，让至少一篇文档发生截断。',check:{ok:d.budget<=80&&context.some(v=>v.truncated),text:d.budget<=80&&context.some(v=>v.truncated)?'完成！检索结果仍存在，但正文因预算不足被截断。':'使用“低显存微调”等示例问题，缩小正文预算，并查看最后一步的入选原因。'}};
    },
    network(d) {
      const t=M.networkTrace(d.net,M.datasets[d.dataset],d.rate,d.sample,d.neuron),j=d.neuron;
      const h=t.prediction.hidden[j],z=t.prediction.preactivation[j];
      const visual={kind:'network',trace:t};
      return {title:'拆开一次真实训练更新',intro:'选中样本用于展开计算；实际更新使用四个样本的平均梯度。切换样本或神经元不会训练网络。',steps:[
        step('输入与隐藏层','zⱼ = wⱼ · x + bⱼ; hⱼ = tanh(zⱼ)','连线表示权重，节点显示激活值。当前展开第 '+(j+1)+' 个隐藏神经元。',[
          ['样本',vector(t.x),'目标 '+t.y],['加权求和',`${n(t.before.w[j][0])} × ${t.x[0]} + ${n(t.before.w[j][1])} × ${t.x[1]} + ${n(t.before.b[j])}`,n(z)],['隐藏激活','tanh('+n(z)+')',n(h)]],
          'z = dot(weights, x) + bias\nhidden = Math.tanh(z)',visual),
        step('输出与损失','p = sigmoid(v · h + c)','sigmoid 把输出压到 0 到 1。损失衡量预测概率与标签的差异，下表同时给出样本损失和全批损失。',[
          ['输出 logit','Σ vⱼhⱼ + c',n(t.prediction.z)],['预测概率','sigmoid(z)',n(t.prediction.output)],['样本损失','−y ln(p) − (1−y) ln(1−p)',n(M.gradients(t.before,[M.datasets[d.dataset][d.sample]]).loss)],['四样本平均损失','mean(loss)',n(t.batch.loss)]],
          'p = 1 / (1 + Math.exp(-z))\nloss = -y * Math.log(p) - (1-y) * Math.log(1-p)',visual),
        step('反向传播','δout = p − y; δⱼ = δout vⱼ (1 − hⱼ²)','先由输出误差回传到隐藏层，再乘以输入，得到选中样本对权重的梯度。',[
          ['输出梯度','p − y',n(t.delta)],['隐藏梯度',`δout × v${j+1} × (1 − h${j+1}²)`,n(t.hiddenDelta[j])],['样本 ∂L/∂wⱼ₁','δⱼ × x₁',n(t.sampleGradient.w[j][0])]],
          'delta = p - y\nhiddenDelta = delta * v[j] * (1 - hidden[j] ** 2)\nsampleGradient = hiddenDelta * x[0]',visual),
        step('汇总批梯度','g = (g₁ + g₂ + g₃ + g₄) / 4','训练按钮使用全批梯度。选中样本的梯度与平均梯度可能方向不同，不能用一个样本替代整个批次。',[
          ...M.datasets[d.dataset].map((sample,i)=>['样本 '+(i+1),vector(sample.x),n(M.gradients(t.before,[sample]).gradient.w[j][0])]),['平均梯度','四项求和 / 4',n(t.batch.gradient.w[j][0])]],
          'gradient = mean(samples.map(sample => gradients(net, [sample])))',visual),
        step('更新全部参数','θ′ = θ − ηg','这里只展开一条权重，执行时会同时更新全部权重和偏置。新损失由更新后的网络重新计算。',[
          ['原权重',`w${j+1},1`,n(t.before.w[j][0])],['更新量',n(d.rate)+' × '+n(t.batch.gradient.w[j][0]),n(d.rate*t.batch.gradient.w[j][0])],['新权重','原权重 − 更新量',n(t.after.w[j][0])],['更新后平均损失','重新前向计算',n(t.nextLoss)]],
          'weight -= rate * batchGradient\nnextLoss = gradients(updatedNet, data).loss',{...visual,after:true})],
        question:{prompt:'仅切换“查看样本”，网络的参数会变化吗？',options:['不会，只改变展开对象','会，立刻用该样本训练'],answer:0,explanation:'查看样本和训练是独立操作。只有训练按钮或“执行一次更新”才修改参数。'},
        challenge:'在 XOR 数据上训练，让四样本平均交叉熵低于 0.30，观察隐藏层与分类边界。',check:{ok:d.dataset==='xor'&&t.batch.loss<.3,text:d.dataset==='xor'&&t.batch.loss<.3?'完成！损失已低于 0.30。这里仅有四个训练点，还不能说明泛化能力。':'选择 XOR，连续训练或分批训练，观察平均损失是否降到 0.30 以下。'},commit:'执行一次更新'};
    }
  };

  function drawVisual(host,visual) {
    host.replaceChildren();
    if(!visual)return;
    const NS='http://www.w3.org/2000/svg';
    const svg=(tag,attrs,text)=>{const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;return el;};
    if(visual.kind==='bars') {
      const max=Math.max(1e-10,...visual.values.map(Math.abs));
      visual.labels.forEach((label,i)=>{
        const row=node('div','lesson-bar-row'),track=node('span','lesson-bar-track'),fill=node('span','lesson-bar-fill');
        fill.style.width=Math.abs(visual.values[i])/max*100+'%';if(visual.values[i]<0)fill.classList.add('is-negative');track.append(fill);
        row.append(node('span','',label),track,node('code','',n(visual.values[i])));host.append(row);
      });
      if(!visual.labels.length)host.append(node('p','','当前没有非零分量。'));
      host.append(node('small','','条长表示数值的绝对大小，橙色表示负值；精确数值见右侧。'));return;
    }
    const stacked=visual.kind==='network'&&window.matchMedia('(max-width:600px)').matches;
    const canvas=svg('svg',{viewBox:visual.kind==='network'?(stacked?'0 0 340 430':'0 0 560 280'):'0 0 560 240',role:'img','aria-label':visual.kind==='gradient'?'损失曲线、当前参数与更新方向':visual.kind==='network'?'2 到 4 到 1 网络，连线表示权重，节点表示激活值':'累计概率区间与随机数落点'});
    if(visual.kind==='gradient') {
      const domain=Math.max(4,Math.abs(visual.weight)*1.25,Math.abs(visual.next)*1.25),x=w=>35+(w+domain)/(2*domain)*490,y=l=>205-l/(domain*domain)*170;
      canvas.append(svg('path',{d:'M35 205H525',class:'lesson-axis'}));
      canvas.append(svg('path',{d:Array.from({length:101},(_,i)=>{const w=-domain+i/100*domain*2;return `${i?'L':'M'}${x(w)},${y(w*w)}`;}).join(' '),class:'lesson-curve'}));
      canvas.append(svg('circle',{cx:x(visual.weight),cy:y(visual.loss),r:7,class:'lesson-dot'}));
      canvas.append(svg('text',{x:35,y:20},'L(w) = w² · 紫点为当前参数'));
      if(visual.phase===1){const dx=domain*.2,w=visual.weight;canvas.append(svg('line',{x1:x(w-dx),y1:y(visual.loss-visual.gradient*dx),x2:x(w+dx),y2:y(visual.loss+visual.gradient*dx),class:'lesson-tangent'}));}
      if(visual.phase>=2){canvas.append(svg('line',{x1:x(visual.weight),y1:y(visual.loss),x2:x(visual.next),y2:y(visual.nextLoss),class:'lesson-tangent'}));canvas.append(svg('circle',{cx:x(visual.next),cy:y(visual.nextLoss),r:7,class:'lesson-next'}));}
      canvas.append(svg('text',{x:35,y:232},'当前 w = '+n(visual.weight)+(visual.phase>=2?' → 下一步 w = '+n(visual.next):'')));
    } else if(visual.kind==='intervals') {
      const colors=['#7569af','#6a9bbd','#669d85','#c48c60','#ad769d'];
      visual.probabilities.forEach((p,i)=>{if(p>0){canvas.append(svg('rect',{x:30+visual.intervals[i].start*500,y:60,width:p*500,height:55,fill:colors[i]}));canvas.append(svg('text',{x:30+(visual.intervals[i].start+p/2)*500,y:145,'text-anchor':'middle'},words[i]));}});
      const x=30+visual.draw*500;canvas.append(svg('line',{x1:x,y1:35,x2:x,y2:122,class:'lesson-tangent'}));
      canvas.append(svg('text',{x:30,y:190},`r = ${n(visual.draw)} → ${words[visual.selected]}`));canvas.append(svg('text',{x:30,y:220},'0                                       累计概率                                       1'));
    } else {
      const t=visual.trace,net=visual.after?t.after:t.before,p=M.forward(net,t.x);
      const input=i=>stacked?[105+i*130,55]:[65,90+i*100],hidden=j=>stacked?[45+j*83,205]:[270,40+j*65],output=stacked?[170,355]:[495,140];
      for(let i=0;i<2;i++)for(let j=0;j<4;j++){const [x1,y1]=input(i),[x2,y2]=hidden(j);canvas.append(svg('line',{x1,y1,x2,y2,class:'lesson-edge','stroke-width':1+Math.min(4,Math.abs(net.w[j][i])),stroke:net.w[j][i]<0?'#c48c60':'#817bba'}));}
      for(let j=0;j<4;j++){const [x1,y1]=hidden(j),[x2,y2]=output;canvas.append(svg('line',{x1,y1,x2,y2,class:'lesson-edge','stroke-width':1+Math.min(4,Math.abs(net.v[j])),stroke:net.v[j]<0?'#c48c60':'#817bba'}));}
      const point=(x,y,text,selected=false)=>{canvas.append(svg('circle',{cx:x,cy:y,r:27,class:selected?'lesson-node is-selected':'lesson-node'}));canvas.append(svg('text',{x,y:y+5,'text-anchor':'middle'},text));};
      t.x.forEach((v,i)=>point(...input(i),String(v)));p.hidden.forEach((v,j)=>point(...hidden(j),v.toFixed(2),j===t.neuron));point(...output,p.output.toFixed(2));
      if(stacked){canvas.append(svg('text',{x:15,y:110},'输入 x'));canvas.append(svg('text',{x:15,y:260},'隐藏层 tanh · 描边表示选中神经元'));canvas.append(svg('text',{x:15,y:410},visual.after?'下次更新后的预测预览':'当前预测 · sigmoid 输出'));}
      else canvas.append(svg('text',{x:20,y:275},'输入                         隐藏层 tanh                          '+(visual.after?'下次更新预览':'当前输出')));
    }
    host.append(canvas);
  }

  const controllers=new WeakMap();
  function mount(root,type,commit,pause) {
    if(controllers.has(root))return controllers.get(root);
    const heading=root.querySelector('.lab-experiment-heading');
    const mode=node('div','lab-learning-mode'),explore=node('button','ai-preset','自由探索'),learn=node('button','ai-preset','分步学习');
    mode.setAttribute('role','group');mode.setAttribute('aria-label','实验模式');
    [explore,learn].forEach(b=>{b.type='button';mode.append(b);});explore.setAttribute('aria-pressed','true');learn.setAttribute('aria-pressed','false');
    const box=node('section','lab-lesson');box.hidden=true;box.setAttribute('aria-label','算法分步学习');
    const title=node('h3'),intro=node('p','lesson-intro'),steps=node('ol','lesson-steps'),content=node('div','lesson-content'),visual=node('div','lesson-visual');
    const detail=node('div','lesson-detail'),stepTitle=node('h4'),formula=node('p','lesson-formula'),explanation=node('p'),tableWrap=node('div','lesson-table-wrap'),table=node('table','lesson-table'),codeDetails=node('details','lesson-code'),code=node('code');
    const thead=node('thead'),tr=node('tr');['对象','计算 / 输入','结果'].forEach(text=>{const th=node('th','',text);th.scope='col';tr.append(th);});thead.append(tr);const tbody=node('tbody');table.append(thead,tbody);tableWrap.append(table);
    const pre=node('pre');pre.append(code);codeDetails.append(node('summary','','对应计算代码'),pre);
    detail.append(stepTitle,formula,explanation,tableWrap,codeDetails);content.append(visual,detail);
    const nav=node('div','lesson-nav'),prev=node('button','ai-preset','上一步'),next=node('button','ai-preset','下一步'),play=node('button','ai-preset','可莉语音讲解'),restart=node('button','ai-preset','从头查看'),apply=node('button','lab-button lab-button-primary');
    [prev,next,play,restart,apply].forEach(b=>{b.type='button';nav.append(b);});
    const status=node('p','lesson-position');status.setAttribute('role','status');
    const question=node('details','lesson-question'),questionTitle=node('summary','','先预测，再查看计算'),questionPrompt=node('p'),options=node('div','lesson-options'),answer=node('p','lesson-feedback');answer.setAttribute('role','status');question.append(questionTitle,questionPrompt,options,answer);
    const speechBox=node('div','lesson-speech'),speechState=node('strong'),transcript=node('p','lesson-transcript'),readInstead=node('button','ai-preset','阅读后答题');
    speechBox.hidden=true;readInstead.hidden=true;readInstead.type='button';speechState.setAttribute('role','status');transcript.setAttribute('aria-live','off');speechBox.append(node('span','lesson-speaker','✦ 可莉领学'),speechState,transcript,readInstead);
    const quiz=node('dialog','lesson-quiz'),quizTitle=node('h3'),quizPrompt=node('p','lesson-quiz-prompt'),quizOptions=node('div','lesson-quiz-options'),quizFeedback=node('div','lesson-quiz-feedback'),quizNav=node('div','lesson-quiz-nav');
    quizTitle.id='lesson-quiz-title-'+type;quiz.setAttribute('aria-labelledby',quizTitle.id);quizFeedback.setAttribute('role','status');
    const quizPause=node('button','ai-preset','先暂停'),quizReplay=node('button','ai-preset','重听本节'),quizContinue=node('button','lab-button lab-button-primary','答对后继续');
    [quizPause,quizReplay,quizContinue].forEach(b=>{b.type='button';quizNav.append(b);});quiz.append(node('span','lesson-speaker','可莉的小检查'),quizTitle,quizPrompt,quizOptions,quizFeedback,quizNav);
    const challenge=node('div','lesson-challenge'),task=node('p'),check=node('button','ai-preset','检查目标'),feedback=node('div','lesson-feedback lesson-challenge-feedback');check.type='button';feedback.setAttribute('role','status');feedback.tabIndex=-1;challenge.append(node('strong','','动手挑战'),task,check,feedback);
    box.append(title,intro,speechBox,question,steps,content,status,nav,challenge,quiz);heading.after(mode,box);
    let model=null,index=0,signature='',revision=0,session=null,voiceSerial=0,quizPassed=false;
    const curriculum=window.LabCurriculum?.[type]||[];
    const closeQuiz=()=>{if(quiz.open)quiz.close();};
    function playbackUI() {
      if(!model)return;
      const running=session&&['loading','speaking'].includes(session.phase);
      play.textContent=running?'暂停可莉讲解':session&&session.phase!=='complete'?'继续可莉讲解':'可莉语音讲解';
      speechBox.hidden=!session;readInstead.hidden=session?.phase!=='error';question.hidden=Boolean(session);
      steps.querySelectorAll('button').forEach((b,i)=>{b.disabled=Boolean(session&&session.phase!=='complete'&&i>session.unlocked);});
      prev.disabled=index===0;next.disabled=index===model.steps.length-1||Boolean(session&&session.phase!=='complete'&&index+1>session.unlocked);
      apply.disabled=model.canCommit===false||Boolean(session&&session.phase!=='complete');
      root.dataset.lessonPhase=session?.phase||'manual';
    }
    const stop=()=>{
      voiceSerial++;window.KleeLabVoice?.stop(root);closeQuiz();
      if(session&&session.phase!=='complete'){session.phase='paused';speechState.textContent='已暂停，继续后重听当前部分；答题通过才会前进。';}
      playbackUI();
    };
    const freeze=()=>{if(pause)pause();stop();};
    function render() {
      if(!model)return;
      const current=model.steps[index];
      const focusedStep=Array.from(steps.querySelectorAll('button')).indexOf(document.activeElement);
      steps.replaceChildren();model.steps.forEach((s,i)=>{const li=node('li'),b=node('button','',`${i+1}. ${s.title}`);b.type='button';if(i===index)b.setAttribute('aria-current','step');b.addEventListener('click',()=>{freeze();index=i;render();});li.append(b);steps.append(li);});
      if(focusedStep>=0)steps.querySelectorAll('button')[focusedStep]?.focus({preventScroll:true});
      stepTitle.textContent=current.title;formula.textContent=current.formula;explanation.textContent=current.explanation;code.textContent=current.code;
      tbody.replaceChildren();current.rows.forEach(row=>{const tr=node('tr');row.forEach((value,i)=>{const cell=node(i?'td':'th','',String(value));if(i===0)cell.scope='row';tr.append(cell);});tbody.append(tr);});drawVisual(visual,current.visual);
      status.textContent=`第 ${index+1} / ${model.steps.length} 步 · 下方参数改变时，从第一步重新计算。`;
      apply.hidden=!model.commit||index!==model.steps.length-1;apply.textContent=model.commit||'';
      playbackUI();
      root.dataset.lessonStep=String(index);root.dataset.lessonRevision=String(revision);
    }
    const setMode=learning=>{freeze();box.hidden=!learning;root.classList.toggle('is-learning',learning);explore.setAttribute('aria-pressed',String(!learning));learn.setAttribute('aria-pressed',String(learning));render();};
    explore.addEventListener('click',()=>setMode(false));learn.addEventListener('click',()=>setMode(true));
    prev.addEventListener('click',()=>{freeze();index=Math.max(0,index-1);render();});next.addEventListener('click',()=>{if(next.disabled)return;freeze();index=Math.min(model.steps.length-1,index+1);render();});restart.addEventListener('click',()=>{freeze();session=null;index=0;render();});
    function showQuiz() {
      if(!session||document.hidden||box.hidden||root.hidden){stop();return;}
      const assessment=curriculum[index]?.quiz;if(!assessment)return;
      session.phase='quiz';quizPassed=false;quizTitle.textContent=`第 ${index+1} 部分 · ${model.steps[index].title}`;
      quizPrompt.textContent=assessment.prompt;quizOptions.replaceChildren();quizFeedback.replaceChildren();delete quizFeedback.dataset.correct;
      quizContinue.disabled=true;quizContinue.textContent='答对后继续';
      assessment.options.forEach((text,i)=>{
        const b=node('button','lesson-quiz-option',text);b.type='button';b.setAttribute('aria-pressed','false');
        b.addEventListener('click',()=>{
          if(!session||session.phase!=='quiz'||quizPassed)return;
          quizOptions.querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));
          const correct=i===assessment.answer;quizFeedback.dataset.correct=String(correct);
          quizFeedback.replaceChildren(node('strong','',correct?'答对啦！':'还差一点，再试一次'),node('p','',assessment.explanation));
          if(correct){quizPassed=true;session.passed.add(index);session.unlocked=Math.max(session.unlocked,Math.min(index+1,model.steps.length-1));quizContinue.disabled=false;quizContinue.textContent=index===model.steps.length-1?'完成本次讲解':'进入下一部分';quizContinue.focus();}
          playbackUI();
        });quizOptions.append(b);
      });
      speechState.textContent='这一部分讲完啦，完成小检查后再继续。';playbackUI();quiz.showModal();
    }
    function speakPart() {
      if(!session)return;closeQuiz();session.phase='loading';quizPassed=false;
      const ticket=++voiceSerial,part=curriculum[index];
      speechState.textContent='可莉正在准备这一部分的语音…';transcript.textContent='';playbackUI();
      const current=()=>ticket===voiceSerial&&session;
      const onError=error=>{if(!current())return;session.phase='error';speechState.textContent=error.message||'语音暂时不可用，请重试或阅读后答题。';transcript.textContent=part?.text||model.steps[index].explanation;playbackUI();};
      if(!window.KleeLabVoice||!part){onError(new Error('可莉的语音还没有准备好，可以重试或阅读本节后答题。'));return;}
      try {
        Promise.resolve(window.KleeLabVoice.play(`${type}-${index}`,{owner:root,
          onStart:()=>{if(!current())return;session.phase='speaking';speechState.textContent='可莉正在讲解 · '+model.steps[index].title;playbackUI();},
          onProgress:text=>{if(current())transcript.textContent=text;},
          onEnded:()=>{if(!current())return;transcript.textContent=part.text;showQuiz();},
          onCancel:()=>{if(current())stop();},onError
        })).catch(onError);
      } catch(error){onError(error);}
    }
    play.addEventListener('click',()=>{
      if(session&&['loading','speaking'].includes(session.phase)){stop();return;}
      freeze();if(!session||session.phase==='complete'){session={phase:'paused',unlocked:0,passed:new Set()};index=0;render();}speakPart();
    });
    quizPause.addEventListener('click',stop);quiz.addEventListener('cancel',event=>{event.preventDefault();stop();});
    quizReplay.addEventListener('click',()=>{stop();speakPart();});
    readInstead.addEventListener('click',()=>{if(session?.phase==='error'){transcript.textContent=curriculum[index]?.text||'';showQuiz();}});
    quizContinue.addEventListener('click',()=>{
      if(!session||session.phase!=='quiz'||!quizPassed)return;closeQuiz();
      if(index===model.steps.length-1){session.phase='complete';speechState.textContent=`学完啦！${model.steps.length} 个部分的小检查全部通过。接着试试动手挑战吧！`;render();return;}
      index++;render();speakPart();
    });
    apply.addEventListener('click',()=>{freeze();if(commit)commit();});
    check.addEventListener('click',()=>{
      feedback.replaceChildren(node('strong','',model.check.ok?'✓ 目标达成！':'再调整一下，马上就好'),node('p','',model.check.text));feedback.dataset.passed=String(model.check.ok);
      feedback.focus({preventScroll:true});feedback.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    });
    const controller={stop,update(data){
      const key=JSON.stringify(data);if(key===signature)return;signature=key;stop();session=null;index=0;revision++;
      model=lessons[type](data);model.canCommit=data.canCommit;title.textContent=model.title;intro.textContent=model.intro;task.textContent=model.challenge;feedback.textContent='';delete feedback.dataset.passed;
      questionPrompt.textContent=model.question.prompt;options.replaceChildren();answer.textContent='';
      model.question.options.forEach((text,i)=>{const b=node('button','ai-preset',text);b.type='button';b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{options.querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));answer.textContent=(i===model.question.answer?'判断正确。':'再对照计算看看。')+model.question.explanation;});options.append(b);});
      render();
    }};controllers.set(root,controller);return controller;
  }
  window.LabLearning={mount};
})();
