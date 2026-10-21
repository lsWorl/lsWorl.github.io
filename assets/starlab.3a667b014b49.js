/* js/lab-math.js */
/* Small, explicit numerical models used by the browser experiments. */
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
  function sampleTrace(logits, temperature, topK, draw) {
    if (!(draw>=0 && draw<1)) throw new Error('Draw must be in [0, 1).');
    const trace=softmaxTrace(logits,temperature,topK);
    let cumulative=0,selected=-1;
    const intervals=trace.probabilities.map((p,i)=>{
      const start=cumulative;cumulative+=p;
      if(selected<0 && p>0 && draw<cumulative) selected=i;
      return {start,end:cumulative};
    });
    if(selected<0) selected=trace.probabilities.findLastIndex(p=>p>0);
    return {...trace,draw,intervals,selected};
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
  function attentionTrace(query, keys, values, row, causal) {
    const products=keys.map(key=>query.map((value,i)=>value*key[i]));
    const scores=products.map(terms=>terms.reduce((a,b)=>a+b,0));
    const scaled=scores.map(value=>value/Math.sqrt(query.length));
    const masked=scaled.map((value,i)=>causal&&i>row?-Infinity:value);
    const probabilities=softmax(masked);
    const contributions=values.map((value,i)=>value.map(v=>v*probabilities[i]));
    const output=values[0].map((_,j)=>contributions.reduce((sum,v)=>sum+v[j],0));
    return {query:query.slice(),keys:keys.map(v=>v.slice()),values:values.map(v=>v.slice()),products,scores,scaled,masked,probabilities,contributions,output};
  }
  function gradientTrace(weight,rate) {
    const gradient=2*weight,change=rate*gradient,next=weight-change;
    return {weight,rate,loss:weight*weight,gradient,change,next,nextLoss:next*next};
  }
  const vocabulary = ['模型','微调','显存','量化','检索','文档','注意力','训练','参数','向量','知识','学习率','损失','lora','qlora','rag','transformer'];
  function counts(text) {
    const lower=text.toLowerCase();
    return vocabulary.map(term=>/^[a-z]+$/.test(term)
      ? (lower.match(new RegExp('\\b'+term+'\\b','g'))||[]).length
      : lower.split(term).length-1);
  }
  function retrievalTrace(query, documents, topK = 3) {
    const vectors=documents.map(doc=>counts(doc.title+' '+doc.text));
    const idf=vocabulary.map((_,index)=>Math.log((1+documents.length)/(1+vectors.filter(v=>v[index]>0).length))+1);
    const queryCounts=counts(query),q=queryCounts.map((value,index)=>value*idf[index]);
    const weighted=vectors.map(v=>v.map((value,j)=>value*idf[j]));
    const ranked=documents.map((doc,index)=>({...doc,score:cosine(q,weighted[index])}))
      .sort((a,b)=>b.score-a.score || a.id-b.id);
    return {vocabulary:vocabulary.slice(),counts:vectors,queryCounts,idf,queryVector:q,vectors:weighted,ranked,
      found:ranked.filter(doc=>doc.score>0).slice(0,topK)};
  }
  function retrieve(query, documents, topK = 3) {
    return retrievalTrace(query,documents,topK).found;
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
  function networkTrace(net,data,rate,sample=0,neuron=0) {
    const before=JSON.parse(JSON.stringify(net)),after=JSON.parse(JSON.stringify(net));
    const {x,y}=data[sample],prediction=forward(before,x),batch=gradients(before,data);
    const delta=prediction.output-y;
    const hiddenDelta=prediction.hidden.map((h,j)=>delta*before.v[j]*(1-h*h));
    const sampleGradient=gradients(before,[data[sample]]).gradient;
    train(after,data,rate);
    return {before,after,x:x.slice(),y,prediction,delta,hiddenDelta,sampleGradient,batch,
      nextLoss:gradients(after,data).loss,neuron,sample,rate};
  }
  return {softmax,softmaxTrace,sampleTrace,dot,cosine,attention,attentionTrace,gradientTrace,retrieve,retrievalTrace,contextFor,random,network,forward,gradients,train,networkTrace,datasets};
});

;
/* js/lab-curriculum.js */
/* Fixed lesson speech and section assessments; shared by browser and asset tools. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LabCurriculum=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const part=(text,prompt,options,answer,explanation)=>({text,quiz:{prompt,options,answer,explanation}});
  return {
    gradient:[
      part('旅行者，可莉先带你看损失！这里把参数平方，得到当前损失。对照表里的数值，看看这个点离最低点有多远。','本实验的损失 L(w) 如何计算？',['把 w 平方','把 w 乘以学习率','直接取 w'],0,'本实验定义 L(w) = w²，最低点是 w = 0。'),
      part('现在看切线的斜率，也就是梯度。这个函数的梯度是参数的两倍。梯度为正时，我们向左走，才能沿着负梯度下降。','梯度为正时，梯度下降会让参数往哪边移动？',['向右增大','向左减小','保持不变'],1,'更新公式是 w′ = w − ηg；学习率为正、梯度为正时，参数会减小。'),
      part('接着，把学习率和梯度相乘，得到更新量。学习率就像步子的大小，可不是越大越好哦！先看看这一脚会迈多远。','参数更新量 Δ 等于什么？',['学习率加梯度','损失除以梯度','学习率乘梯度'],2,'Δ = ηg，它带有符号；更新参数时还要减去这个量。'),
      part('最后，从旧参数里减去更新量，再计算新损失。对照前后两列，检查损失有没有变小。看懂以后，我们才真正执行更新。','判断这一步有没有降低损失，应当比较什么？',['只看动画走得快不快','比较更新前后的损失','只看参数的正负'],1,'参数可能跨过 0；比较 L′ 和 L 才能确认损失是否降低。')
    ],
    sampling:[
      part('可莉先把每个候选分数除以温度。温度越低，分数之间的差距越明显。看看柱子的变化，概率会更集中还是更平均呢？','降低温度通常会让概率分布怎样变化？',['更集中在高分候选','所有候选概率都相同','自动增加新词'],0,'同一组 logit 除以更小的正温度后，差距扩大，Softmax 更偏向高分候选。'),
      part('这一步只留下分数最高的几个候选。被移除的词，概率就变成零啦。即使继续抽很多次，也抽不到它们。','被 Top-K 移除的候选还能被采到吗？',['偶尔可以','本次分布中不能','温度高就一定可以'],1,'筛选之后才在保留候选中归一化，被移除的项概率为 0。'),
      part('现在把分数变成指数权重，再除以权重总和。这样所有概率加起来就是一。减去最大分数，只是为了让计算更稳定。','为什么计算 Softmax 时可以先减去最大分数？',['会增加词汇量','能改变正确答案','提高数值稳定性且不改变概率'],2,'所有指数项同时乘以同一系数，归一化时会抵消，概率保持不变。'),
      part('每个词占据一段概率区间。随机数落进哪一段，就选中哪个词。注意哦，现在只是预演，点击执行后才会记录这次采样。','随机数应当怎样决定采样结果？',['总是选择分数最高的词','选择随机数落入的累计概率区间','按候选字数选择'],1,'区间左闭右开，长度就是候选概率；边界属于右边的非空区间。')
    ],
    attention:[
      part('旅行者，把查询向量和每个键向量的相同维度相乘，再把结果加起来。可莉把每一项都展开了，这就是一次点积匹配。','Q 与 K 的点积怎样计算？',['只比较第一维','所有维度先求平均','相同维相乘再求和'],2,'点积是对应维度乘积的总和，表格展示了每个乘数与最终分数。'),
      part('点积分数还要除以维度数的平方根。这里有四个维度，所以除以二。先控制分数尺度，再继续计算权重。','本实验维度为 4，缩放分数时除以多少？',['2','4','16'],0,'缩放因子是 √d，因此 √4 = 2。'),
      part('接下来戴上因果遮罩！当前位置后面的词都被挡住，不能提前偷看。它们的分数设为负无穷，稍后权重就会变成零。','因果遮罩会挡住哪些位置？',['当前位置之前的全部词','当前位置之后的词','当前位置自己'],1,'因果注意力允许读取自己和过去的位置，屏蔽未来位置。'),
      part('现在用 Softmax 把分数变成权重。被挡住的位置权重是零，剩下的位置重新分配，总和为一。这些数表示混合比例。','一行注意力权重的总和是多少？',['等于维度数','不固定','1'],2,'Softmax 对未屏蔽的位置归一化；被屏蔽位置占 0，整行仍为 1。'),
      part('有了权重，还要读取值向量。每个值向量乘以自己的权重，再逐维相加，才得到输出。可莉把每一份贡献都列出来啦！','注意力最终输出怎样得到？',['对 V 向量按注意力权重加权求和','直接把 Q 原样输出','只输出权重最大的数字'],0,'输出 O = AV；注意力权重负责分配比例，V 提供被混合的信息。')
    ],
    rag:[
      part('可莉先找问题里命中的关键词，数一数各出现几次。这里使用固定词表，所以没收录的同义词，也可能一个都匹配不到。','查询没有命中任何示例关键词时，会怎样？',['自动找到语义最相近的文档','得到零向量，无法匹配示例资料','自动调用大模型补全'],1,'本实验使用固定词表而非语义 Embedding；零向量的余弦相似度按 0 处理。'),
      part('接着给关键词分配权重。出现在越少文档里的词，区分能力通常越强，权重越高。问题和文档都必须使用同一套词表。','在这里，出现在更少文档中的词通常有什么特点？',['IDF 更高','IDF 永远为零','会被完全删除'],0,'IDF = ln((1 + N)/(1 + DF)) + 1，DF 越小，IDF 越高。'),
      part('现在比较问题和文档向量的方向。余弦相似度越高，排序越靠前。这里只保留分数大于零的前几篇，不能凭空制造证据。','本实验按什么选择检索结果？',['正文越长越优先','只按标题字数','余弦相似度从高到低，且分数大于零'],2,'检索先按相似度降序排序，再保留正分数的 Top-K 篇。'),
      part('最后把检索到的正文依次放进上下文。字符预算用完就停，后面的文档可能被截断。取回很多篇，也不代表能全部放进去。','Top-K 增大后，正文一定都能完整进入上下文吗？',['一定可以','还取决于字符预算','只取决于标题长度'],1,'Top-K 限制篇数，字符预算限制实际正文长度；它也不等于模型的 token 预算。')
    ],
    network:[
      part('可莉选一个样本，先计算输入乘权重，再加偏置。经过双曲正切激活函数，就得到隐藏神经元的输出。描边标出了正在查看的神经元。','隐藏层在加权求和后，还进行了什么运算？',['除以样本编号','使用 tanh 激活','直接四舍五入'],1,'隐藏层使用 h = tanh(w·x + b)，为网络引入非线性。'),
      part('隐藏层的结果继续送到输出层，再变成零到一之间的概率。交叉熵检查这个概率和目标标签差多少，注意区分单个样本与平均损失。','输出层的 sigmoid 将输出转换到哪个范围？',['零到一之间','负一到一之间','所有实数'],0,'sigmoid 的输出在 0 与 1 之间，本实验把它解释为类别 1 的预测概率。'),
      part('接下来把输出误差往回传。先算预测概率减去标签，再沿连接传到隐藏层，乘以激活函数的导数，就能找到权重的梯度。','本实验输出层的误差梯度 δout 是什么？',['标签加预测概率','损失乘学习率','预测概率减标签'],2,'sigmoid 配合二元交叉熵时，对输出 logit 的导数简化为 p − y。'),
      part('一个样本的梯度还不能代表全部训练数据。可莉把四个样本的梯度相加，再除以四。真正更新时，我们使用这个平均值。','训练按钮使用哪一份梯度更新参数？',['四个样本的平均梯度','只用当前查看样本的梯度','随机把梯度改成零'],0,'本实验使用全批梯度：四个样本的梯度求和后除以 4。'),
      part('最后，用学习率乘以平均梯度，从旧参数中减掉它。执行时所有权重和偏置都会更新，然后重新计算损失，看看网络有没有进步！','一次真实训练更新会改变哪些参数？',['只改变描边神经元','全部可训练权重和偏置','只改变正在查看的输入'],1,'表格只展开一条权重，但执行时会同时更新网络全部权重和偏置。')
    ]
  };
});

;
/* js/lab-learning.js */
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

;
/* js/ai-experiments.js */
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
/* Stable portrait layers; expressions and small gestures follow conversation state. */
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
  let animationFrame = null, blinkTimer = null, blinkStep = 0, mouth = 0, sessionPromise = null, playbackTicket = 0;
  let narration = null, samples = null, smoothedEnergy = 0, lastTick = 0, lastMouthChange = 0, renderedFrame = '';
  let healthPromise = null, healthCheckedAt = 0, welcomePending = false, welcomeStarting = false, welcomeBubble = null, welcomeTimer = null;
  const welcomeKey = 'lsworld.klee.welcomed.v1';
  const audioCache = new Map();
  let pcmPlayback = null;
  let expression = 'neutral', reactionTimer = null, gestureTimer = null;
  const articleKey = 'lsworld.klee.articles.v1';
  let articleVisit = null, articleTimer = null, articleBubble = null, articleBubbleTimer = null;
  let articleManifestPromise = null, articleHistory = {}, welcomedThisPage = false;
  let selectionBox, readingList, readingSelection = '', readingSelectionPath = '',readingSelectionAnchor='',readingSelectionTotal=0;
  let studyBox, currentStudy = null;
  let labVoiceRun = null, labManifestPromise = null, labBubble = null;
  const completedActions = new Set();
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const sprite = () => config.animation || {columns: 3, rows: 2, mouthFrames: [0,1,2], blinkFrames: [0,3,0], mouthCenter: [55.5,60.5], eyeCenter: [55.5,48]};
  const framePosition = (index, atlas = sprite()) => {
    const x = atlas.columns > 1 ? index % atlas.columns / (atlas.columns - 1) * 100 : 0;
    const y = atlas.rows > 1 ? Math.floor(index / atlas.columns) / (atlas.rows - 1) * 100 : 0;
    return `${Number(x.toFixed(4))}% ${Number(y.toFixed(4))}%`;
  };
  function expressionFor(text, fallback = 'happy') {
    if (/难过|伤心|孤单|孤独|压力|不开心|烦恼|担心|害怕|没关系|别担心|陪着|抱抱|慢慢来|好累|有点累|累了|疲惫|难受|失败|做不到/.test(text)) return 'care';
    if (/成功|做到了|完成了|厉害|真棒/.test(text)) return 'proud';
    if (/哈哈|嘿嘿|嘻嘻/.test(text)) return 'laugh';
    if (/好耶|开心|太棒|出发|一起玩|谢谢/.test(text)) return 'happy';
    if (/为什么|如何|原理|公式|代码|算法|想想/.test(text)) return 'thinking';
    if (/好奇|真的吗|什么呀|去哪|咦/.test(text)) return 'curious';
    return fallback;
  }
  function setExpression(value) {
    if (!root) return;
    if (!Object.hasOwn(config.expressions?.frames || {}, value)) value = 'neutral';
    if (expression === value && root.dataset.expression === value) return;
    const previous = expression; expression = value; root.dataset.expression = value;
    root.querySelectorAll('.cp-avatar').forEach(avatar => {
      const back = avatar.querySelector('.cp-face-back'), front = avatar.querySelector('.cp-face-front');
      if (!front || !config.expressions) return;
      front.getAnimations().forEach(animation => animation.cancel());
      back.style.setProperty('--cp-expression-position', framePosition(config.expressions.frames[previous] ?? 0, config.expressions));
      front.style.setProperty('--cp-expression-position', framePosition(config.expressions.frames[value] ?? 0, config.expressions));
      back.style.opacity = reducedMotion() ? '0' : '1';
      if (!reducedMotion()) {
        const fade = front.animate([{opacity:0},{opacity:1}], {duration:220,easing:'ease-out'});
        fade.onfinish = () => { back.style.opacity = '0'; };
      }
    });
    if (['laugh','wink'].includes(value)) { clearTimeout(blinkTimer); blinkStep = 0; setFrame(); }
    else if (['laugh','wink'].includes(previous)) scheduleBlink();
  }
  function setPresence(value) { if (root) root.dataset.presence = value; }
  function gesture(value) {
    if (!root || document.hidden || reducedMotion() || root.dataset.gesture === value) return;
    clearTimeout(gestureTimer); root.dataset.gesture = value;
    gestureTimer = setTimeout(() => { root.dataset.gesture = ''; }, value === 'hello' ? 1000 : 760);
  }
  function settleCharacter(delay = 2400) {
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => {
      if (busy || narration || document.hidden) return;
      setPresence('idle'); setExpression('neutral');
    }, delay);
  }
  function greetCharacter() {
    clearTimeout(reactionTimer); setExpression('wink'); gesture('hello');
    reactionTimer = setTimeout(() => {
      if (document.hidden) return;
      setExpression(narration?.view ? expressionFor(narration.view.paragraph.textContent, narration.view.mood) : busy ? 'thinking' : 'happy');
      if (!busy && !narration) settleCharacter(1600);
    }, 1400);
  }
  const setFrame = () => {
    if (!root) return;
    const key = `${mouth}:${blinkStep}`; if (key === renderedFrame) return; renderedFrame = key;
    root.querySelectorAll('.cp-avatar').forEach(avatar => {
      const lips = avatar.querySelector('.cp-mouth'), eyes = avatar.querySelector('.cp-eyes');
      const mouthPosition = framePosition(sprite().mouthFrames[mouth]), eyePosition = framePosition(sprite().blinkFrames[blinkStep]);
      lips.hidden = mouth === 0; if (lips.style.backgroundPosition !== mouthPosition) lips.style.backgroundPosition = mouthPosition;
      eyes.hidden = blinkStep === 0; if (eyes.style.backgroundPosition !== eyePosition) eyes.style.backgroundPosition = eyePosition;
    });
  };
  const scheduleBlink = () => {
    clearTimeout(blinkTimer);
    if (document.hidden || reducedMotion() || ['laugh','wink'].includes(expression)) return;
    blinkTimer = setTimeout(function blink() {
      blinkStep++; setFrame();
      if (blinkStep < sprite().blinkFrames.length - 1) blinkTimer = setTimeout(blink, 40);
      else { blinkStep = 0; setFrame(); scheduleBlink(); }
    }, 3000 + Math.random() * 3500);
  };
  function updateLimits(limits) {
    if (limits) currentLimits = limits;
    quota.textContent = currentLimits ? `今天还能聊 ${Math.min(currentLimits.chatRemaining, currentLimits.voiceRemaining)} 次` : '';
    updateSend();
  }
  function updateSend() {
    if (!send) return;
    const exhausted = currentLimits && (!currentLimits.chatAvailable || !currentLimits.voiceAvailable || Math.min(currentLimits.chatRemaining, currentLimits.voiceRemaining) <= 0);
    send.disabled = busy || !service?.chat || (!service.demo && (!service.voice || exhausted));
    root?.querySelectorAll('[data-study-prompt]').forEach(button => { button.disabled = send.disabled || service?.study === false; });
    root?.querySelectorAll('[data-study-prompt="resume"]').forEach(button=>{button.hidden=currentStudy?.status!=='paused';});
    root?.querySelectorAll('[data-study-prompt="pause"]').forEach(button=>{button.hidden=currentStudy?.status!=='active';});
    if (exhausted && !busy && !narration) state('可莉要休息一会儿啦。');
  }
  async function request(path, method = 'GET', data, authenticated = true, raw = false) {
    if (!apiBase) throw new Error('助手正在准备连接，稍后再来找我吧。');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), path.startsWith('/respond') ? 330000 : 60000);
    try {
      const response = await fetch(apiBase + path, {method, headers: {...(data ? {'Content-Type': 'application/json'} : {}),
        ...(authenticated && token ? {'Authorization': 'Bearer ' + token} : {})}, body: data ? JSON.stringify(data) : undefined, signal: controller.signal});
      if (!response.ok) {
        if (response.status === 401) { token = ''; persist(); sessionPromise = null; }
        let result; try { result = await response.json(); } catch (_) {}
        throw new Error(result?.error || '连接暂时没成功，稍后再试试吧。');
      }
      if (typeof raw === 'function' && response.headers.get('Content-Type')?.includes('text/event-stream')) {
        const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', result = null, complete = false;
        try {
          while (true) {
            const {done, value} = await reader.read(); buffer += decoder.decode(value, {stream: !done});
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
              const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
              const line = event.split('\n').find(value => value.startsWith('data: ')); if (!line) continue;
              const data = JSON.parse(line.slice(6)); raw(data);
              if (data.type === 'done' || data.type === 'error') { complete = true; result = data.result; if (data.type === 'error' && !result) throw new Error(data.error); }
            }
            if (done) break;
          }
          if (!complete) throw new Error('可莉的声音断了一下，先看看这句话吧。');
          return result;
        } finally { await reader.cancel().catch(() => {}); }
      }
      if (raw === 'reply') {
        const metadata = response.headers.get('X-Companion-Reply');
        if (!metadata) return await response.json();
        const result = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(metadata), value => value.charCodeAt(0))));
        return {...result, audioBlob: await response.blob()};
      }
      return raw && typeof raw !== 'function' ? await response.blob() : await response.json();
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
    if (value && labVoiceRun) stopAudio();
    if (value) cancelArticle();
    opened = value; root.querySelector('.cp-panel').hidden = !value;
    if (value && welcomeBubble) welcomeBubble.hidden = true;
    root.querySelector('.cp-launcher').hidden = value;
    root.querySelector('.cp-launcher').setAttribute('aria-expanded', String(value));
    if (value) { refresh(); textarea.focus(); setPresence('listening'); setExpression('happy'); gesture('hello'); settleCharacter(); }
    else { stopAudio(); clearTimeout(reactionTimer); setPresence('idle'); setExpression('neutral'); root.querySelector('.cp-launcher').focus(); }
  }
  async function refresh() {
    try {
      const [health, result] = await Promise.all([ensureHealth(), token ? request('/state') : null]); service = health;
      if (!narration) state(service.demo ? '本地演示' : service.chat ? '嘟嘟可也在听。' : '可莉一会儿就来。');
      updateSend();
      if (service.demo) report('本地演示：回复用于验证界面，没有调用真实聊天模型。');
      else if (!service.chat) report('可莉一会儿就来，先看看博客吧。');
      else report('');
      if (result) {
        updateLimits(result.limits);
        if (Object.hasOwn(result, 'study') && !busy) renderStudy(result.study);
        if (!busy) { messageList.replaceChildren(); if (!result.messages.length) welcome(); result.messages.forEach(message => addMessage(message)); }
      }
    } catch (error) { updateSend(); report(error.message); }
  }
  function ensureHealth() {
    if (service && Date.now() - healthCheckedAt < 30000) return Promise.resolve(service);
    if (!healthPromise) healthPromise = request('/health', 'GET', null, false).then(result => { service = result; healthCheckedAt = Date.now(); updateSend(); return result; }).finally(() => { healthPromise = null; });
    return healthPromise;
  }
  function welcome() { addMessage({role: 'assistant', text: config.greeting}); }
  function readingContext() {
    if (!config.reading?.enabled || service?.reading === false || !document.querySelector('#post #article-container')) return null;
    let anchor = readingSelection && readingSelectionPath===location.pathname?readingSelectionAnchor:'';
    if (!anchor) {
      for (const heading of document.querySelectorAll('#article-container h1[id],#article-container h2[id],#article-container h3[id],#article-container h4[id]')) {
        if (heading.getBoundingClientRect().top <= 160) anchor = heading.id;
      }
    }
    if(!anchor){try{anchor=decodeURIComponent(location.hash.slice(1));}catch{}}
    return {path: location.pathname, anchor,
      contentHash:document.querySelector('#post #article-container')?.dataset.companionHash||document.querySelector('meta[name="companion-content-hash"]')?.content||'',
      selectionTruncated:readingSelectionTotal>(config.reading.maxSelection||2000),selection: readingSelectionPath === location.pathname ? readingSelection : ''};
  }
  function updateSelection() {
    if (!selectionBox) return;
    const text = readingSelectionPath === location.pathname ? readingSelection : '';
    selectionBox.hidden = !text || !readingList.hidden;
    selectionBox.querySelector('span').textContent = text ? '一起看这段：' + [...text].slice(0, 40).join('') + ([...text].length > 40 ? '…' : '')+(readingSelectionTotal>(config.reading.maxSelection||2000)?'（先读取前2000字）':'') : '';
  }
  function captureSelection() {
    const article = document.querySelector('#post #article-container'), selection = window.getSelection();
    if (!article || !selection?.rangeCount || selection.isCollapsed
      || !article.contains(selection.anchorNode) || !article.contains(selection.focusNode)) return;
    const characters=[...selection.toString().trim()];readingSelectionTotal=characters.length;
    readingSelection=characters.slice(0,config.reading.maxSelection||2000).join('');readingSelectionAnchor='';
    const start=selection.getRangeAt(0).startContainer;
    for(const heading of article.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]'))if(heading===start || heading.contains(start) || heading.compareDocumentPosition(start)&Node.DOCUMENT_POSITION_FOLLOWING)readingSelectionAnchor=heading.id;
    readingSelectionPath = location.pathname; updateSelection();
  }
  function articleHref(value) {
    try {
      const url = new URL(value);
      if (url.origin !== (config.reading?.siteOrigin || location.origin) || !['https:','http:'].includes(url.protocol)) return null;
      // Keep navigation on the current deployment, including Pages previews.
      return url.pathname + url.search + url.hash;
    } catch (_) { return null; }
  }
  function applyReadingActions(view) {
    if (!view?.canAct || !opened || document.hidden || messageList.hidden || !view.item.isConnected || completedActions.has(view.message.id)) return;
    const action = view.message.actions?.find(action => action.type === 'open_article');
    const href = action && articleHref(action.url);
    if (!href) return;
    const key = 'lsworld.klee.action.' + view.message.id;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, 'done'); } catch (_) {}
    completedActions.add(view.message.id); view.canAct = false;
    location.assign(href);
  }
  function completePlayback() {
    if (labVoiceRun && narration?.lab) {
      if (!audio?.ended) return;
      const completed = labVoiceRun; labVoiceRun = null;
      stopAudio(); state('这一部分讲完啦，试试习题吧！'); completed.callbacks.onEnded?.(); return;
    }
    const failure = pcmPlayback?.failure;
    const view = pcmPlayback?.view || narration?.view;
    stopAudio(); state('嘟嘟可也在听。'); applyReadingActions(view);
    if(failure){report(failure);offerVoiceRetry(view);state('声音中途断开了，文字已经保留。');}
  }
  function showChat() {
    readingList.hidden = true; messageList.hidden = false; form.hidden = false; updateSelection(); renderStudy(currentStudy); textarea.focus();
  }
  async function showReadLater() {
    stopAudio(); readingList.replaceChildren(); readingList.hidden = false; messageList.hidden = true; form.hidden = true; updateSelection();
    if (studyBox) studyBox.hidden = true;
    root.querySelector('.cp-options').open = false;
    const header = node('div', 'cp-reading-header');
    header.append(node('strong', '', '稍后阅读'), button('返回聊天', '', showChat)); readingList.append(header);
    const loading = node('p', '', '可莉找找小本子…'); readingList.append(loading);
    try {
      await ensureSession(); const result = await request('/bookmarks'); loading.remove();
      if (!result.articles.length) readingList.append(node('p', '', '还没有记下文章呢。看到喜欢的，可以让可莉收藏起来！'));
      for (const article of result.articles) {
        const href = articleHref(article.url); if (!href) continue;
        const row = node('div', 'cp-reading-item'), link = node('a', '', article.title); link.href = href;
        const remove = button('移除', '', async () => {
          remove.disabled = true;
          try { await request('/bookmarks/' + encodeURIComponent(article.id), 'DELETE'); row.remove(); }
          catch (error) { report(error.message); remove.disabled = false; }
        });
        remove.setAttribute('aria-label', '移除收藏：' + article.title); row.append(link, remove); readingList.append(row);
      }
    } catch (error) { loading.textContent = error.message; }
  }
  function studyPrompt(text) {
    if (busy || send.disabled) return;
    root.querySelector('.cp-options').open = false; showChat(); textarea.value = text; form.requestSubmit();
  }
  function renderStudy(value) {
    if (!studyBox) return;
    currentStudy = value && Array.isArray(value.steps) && value.steps.length > 0 && value.steps.length <= 5
      && value.steps[value.currentStep] && articleHref(value.article?.url) ? value : null;
    const expanded = studyBox.querySelector('details')?.open || false;
    studyBox.replaceChildren(); studyBox.hidden = !currentStudy || !readingList.hidden;
    updateSend();
    if (!currentStudy) return;
    const study = currentStudy, details = node('details'), summary = node('summary', '', study.status === 'completed' ? '好耶，这篇学完啦！'
      : (study.status === 'paused' ? '下次接着学' : '一起学') + ' · 第 ' + (study.currentStep + 1) + '/' + study.steps.length + ' 步');
    details.open = expanded;
    const article = node('a', 'cp-study-article', study.article.title); article.href = articleHref(study.article.url);
    const list = node('ol', 'cp-study-steps');
    study.steps.forEach((step, index) => {
      const item = node('li', '', step.title);
      if (index === study.currentStep) item.setAttribute('aria-current', 'step');
      list.append(item);
    });
    details.append(summary, article, node('span', 'cp-study-time', '约 ' + study.minutes + ' 分钟'), list);
    const current = node('p', 'cp-study-current', study.steps[study.currentStep].title), controls = node('div', 'cp-study-controls');
    const action = (label, prompt) => { const control = button(label, '', () => studyPrompt(prompt)); control.dataset.studyPrompt = prompt; return control; };
    if (study.status === 'paused') controls.append(action('接着学', '继续上次学习'));
    else if (study.status === 'completed') controls.append(action('再学一遍', '从头学上次那篇文章'));
    else controls.append(action('换个说法', '没听懂，换个说法'), action('懂了，下一步', '懂了，下一步'));
    studyBox.append(details, current, controls); updateSend();
  }
  function addMessage(message, pending = false) {
    const item = node('div', 'cp-message'); item.dataset.role = message.role;
    const paragraph = node('p', '', pending ? '唔…让可莉想一想。' : message.text); item.append(paragraph);
    if (pending) { item.classList.add('cp-pending'); item.setAttribute('aria-busy', 'true'); }
    const view = {item, paragraph, message, characters: [...String(message.text || '')], revealed: pending ? 0 : [...String(message.text || '')].length};
    if (!pending) addSources(view);
    messageList.append(item); messageList.scrollTop = messageList.scrollHeight;
    return view;
  }
  function addSources(view) {
    const {message, item} = view;
    renderReadingDetail(view);
    const currentHash=document.querySelector('#post #article-container')?.dataset.companionHash;
    if(currentHash && message.sources?.some(source=>{try{return new URL(source.url).pathname===location.pathname && source.contentHash && source.contentHash!==currentHash;}catch{return false;}}) && !item.querySelector('.cp-source-stale'))item.append(node('small','cp-source-stale','这条解释对应文章的旧版本。'));
    if (item.querySelector('.cp-sources')) return;
    if (message.sources?.length) {
      const links = node('div', 'cp-sources');
      message.sources.forEach(source => {
        try {
          const url = new URL(source.url); if (!['http:','https:'].includes(url.protocol)) return;
          const label = source.title + (source.heading && source.heading !== '正文' ? ' · ' + source.heading : '');
          const link = node('a', '', '↗ ' + label); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
        } catch (_) {}
      });
      item.append(links);
    }
  }
  function renderReadingDetail(view){
    const {message,item}=view;
    if(message.reading && !item.querySelector('.cp-reading-range')){
      const range=message.reading;item.append(node('small','cp-reading-range','阅读范围：'+range.label+(range.partial?'（部分内容）':'')));
      if(range.nextCursor!==null && range.nextCursor!==undefined)item.append(button('继续读本节','cp-read-next',()=>studyPrompt('继续读本节的下一段')));
    }
    if(!message.detail || item.querySelector('.cp-answer-detail'))return;
    const details=node('details','cp-answer-detail');details.open=true;
    details.append(node('summary','','详细说明'));const body=node('div','cp-answer-body');
    const inline=(parent,text)=>{for(const part of text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g)){if(part.startsWith('`')&&part.endsWith('`'))parent.append(node('code','',part.slice(1,-1)));else if(part.startsWith('**')&&part.endsWith('**'))parent.append(node('strong','',part.slice(2,-2)));else parent.append(document.createTextNode(part));}};
    let paragraph=[],codeLines=null;
    const flush=()=>{if(!paragraph.length)return;const p=node('p');inline(p,paragraph.join('\n'));body.append(p);paragraph=[];};
    const finishCode=()=>{const block=node('div','cp-code-block'),pre=node('pre'),code=node('code','',codeLines.join('\n'));
      const copy=button('复制代码','cp-copy-code',async()=>{try{await navigator.clipboard.writeText(code.textContent);copy.textContent='已复制';}catch{copy.textContent='请选中代码复制';}});pre.append(code);block.append(copy,pre);body.append(block);codeLines=null;};
    for(const line of String(message.detail).split('\n')){
      if(/^\s*```/.test(line)){if(codeLines===null){flush();codeLines=[];}else finishCode();continue;}
      if(codeLines!==null){codeLines.push(line);continue;}
      if(!line.trim()){flush();continue;}
      if(/^#{1,4}\s/.test(line)){flush();const heading=node('h4');inline(heading,line.replace(/^#+\s*/,''));body.append(heading);}
      else paragraph.push(line);
    }
    if(codeLines!==null)finishCode();flush();details.append(body);
    const controls=node('div','cp-detail-controls');controls.append(node('small','','语音讲解要点，完整内容见上方。'),button('展开阅读','cp-expand-reading',event=>{
      const expanded=root.classList.toggle('cp-reading-expanded');event.currentTarget.textContent=expanded?'收起阅读':'展开阅读';
    }));details.append(controls);item.append(details);
    const math=window.MathJax;if(math?.typesetPromise)Promise.resolve(math.startup?.promise).then(()=>math.typesetPromise([body])).catch(()=>{});
  }
  function revealReply(view, count) {
    count = Math.max(view.revealed, Math.min(view.characters.length, count));
    if (count === view.revealed && !view.item.classList.contains('cp-pending')) return;
    view.revealed = count; view.paragraph.textContent = view.characters.slice(0, count).join('');
    view.item.classList.remove('cp-pending'); messageList.scrollTop = messageList.scrollHeight;
  }
  function finishReply(view = narration?.view) {
    if (!view) return;
    revealReply(view, view.characters.length); view.item.setAttribute('aria-busy', 'false'); addSources(view);
  }
  function offerVoiceRetry(view) {
    if (!view.message.id || view.item.querySelector('.cp-retry-voice')) return;
    const actions = node('div', 'cp-message-actions');
    const retry = button('重试语音', 'cp-retry-voice', async () => {
      if (busy) return;
      busy = true; updateSend(); retry.disabled = true; stopAudio(); primeAudio();
      const ticket = playbackTicket; state('正在重新准备这段声音…'); report('');
      try {
        const spoken = await request('/speech', 'POST', {messageId:view.message.id}); updateLimits(spoken.limits);
        if (ticket !== playbackTicket || !opened || document.hidden) return;
        const audioBlob = await request('/audio/' + encodeURIComponent(spoken.audioId), 'GET', null, true, true);
        await playSpeech({...view.message, audioBlob}, view, ticket);
        if (ticket === playbackTicket) actions.remove();
      } catch (error) { report(error.message); state('文字已保留，声音暂时没连上。'); }
      finally { busy = false; retry.disabled = false; updateSend(); }
    });
    actions.append(retry); view.item.append(actions);
  }
  async function submit(event) {
    event.preventDefault(); const text = textarea.value.trim(); if (!text || busy) return;
    if (send.disabled) return;
    captureSelection(); const reading = readingContext();report('');
    cancelWelcome(); busy = true; send.disabled = true; textarea.disabled = true; stopAudio(); const ticket = playbackTicket; state('唔，让可莉想想…');
    clearTimeout(reactionTimer); setPresence('thinking'); setExpression('thinking');
    primeAudio();
    let view = null;
    try {
      await ensureSession(); addMessage({role: 'user', text}); textarea.value = '';
      view = addMessage({role: 'assistant', text: ''}, true);
      view.mood = expressionFor(text, 'happy');
      const result = await request('/respond-stream', 'POST', {text, requestId: crypto.randomUUID(), autoSpeak: true, voiceProtocol:2,readingProtocol:2, ...(reading ? {reading} : {})}, true, data => receiveStream(data, view, ticket));
      view.message = result; view.characters = [...result.text]; updateLimits(result.limits);
      readingSelection = ''; updateSelection();
      if (result.demo) report('本地演示：没有调用真实聊天模型。');
      if (!pcmPlayback || ticket !== playbackTicket) {
        finishReply(view); state('嘟嘟可也在听。');
        if (ticket === playbackTicket && opened) { setPresence('idle'); setExpression(expressionFor(result.text, view.mood)); settleCharacter(); }
      }
    } catch (error) {
      let deferred=false;
      if (view?.characters.length) {
        view.canAct = false;
        // A broken transport must not discard audio already buffered for this
        // reply. Explicit Stop / close / a new turn still cancel immediately.
        if (pcmPlayback?.view === view) {
          flushPCM(pcmPlayback);pcmPlayback.finished=true;
          if(pcmPlayback.sources.size){pcmPlayback.failure=error.message;deferred=true;state('正在播放已收到的声音…');}
        }
        finishReply(view);
      }
      else { view?.item.remove(); textarea.value = text; }
      if(!deferred){report(error.message);state('再说一次好不好？');setPresence('idle');setExpression('care');settleCharacter();}
    }
    finally { busy = false; updateSend(); textarea.disabled = false; textarea.focus(); }
  }
  function stopAudio() {
    const interruptedLab = labVoiceRun; labVoiceRun = null;
    if (labBubble) labBubble.hidden = true;
    playbackTicket++;
    if (pcmPlayback) { for (const source of pcmPlayback.sources) { try { source.stop(); } catch (_) {} } pcmPlayback = null; }
    if (narration?.welcome && welcomeBubble) { clearTimeout(welcomeTimer); welcomeTimer = setTimeout(() => { welcomeBubble.hidden = true; }, 1200); }
    if (narration?.article && articleBubble) {
      articleBubble.querySelector('p').textContent = narration.article.text;
      clearTimeout(articleBubbleTimer); articleBubbleTimer = setTimeout(() => { articleBubble.hidden = true; }, 3500);
    }
    finishReply(); narration = null;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null;
    mouth = 0; smoothedEnergy = 0; lastTick = 0; lastMouthChange = 0;
    if (root) { root.classList.remove('cp-playing'); root.querySelector('.cp-stop').hidden = true; setFrame(); }
    if (root) {
      setPresence(busy ? 'thinking' : 'idle');
      if (busy) setExpression('thinking'); else { if (expression === 'laugh' || expression === 'wink') setExpression('happy'); settleCharacter(); }
    }
    interruptedLab?.callbacks.onCancel?.();
  }
  function failLabVoice(error) {
    const failed = labVoiceRun; labVoiceRun = null; stopAudio(); failed?.callbacks.onError?.(error);
  }
  async function playLabVoice(id, callbacks) {
    if (busy) { callbacks.onError?.(new Error('可莉正在回答聊天，请等回答结束后再开始讲解。')); return; }
    if (opened) setOpen(false);
    cancelWelcome(); cancelArticle(); stopAudio(); primeAudio();
    const run = {id, callbacks, owner: callbacks.owner}; labVoiceRun = run;
    try {
      if (!/^\w+-\d+$/.test(id)) throw new Error('无法找到这一节的讲解。');
      if (!labManifestPromise) labManifestPromise = fetch('/lab-narration.json', {cache: 'no-cache'})
        .then(response => { if (!response.ok) throw new Error('讲解音频暂时无法加载，请重试。'); return response.json(); })
        .catch(error => { labManifestPromise = null; throw error; });
      const manifest = await labManifestPromise;
      if (labVoiceRun !== run) return;
      const line = manifest.lines[id], [type, position] = id.split('-');
      if (!line || line.text !== window.LabCurriculum?.[type]?.[Number(position)]?.text || !/^\/audio\/lab\/[a-z0-9-]+\.wav$/.test(line.audio)) throw new Error('这一节的可莉语音尚未准备好，请重试或阅读后答题。');
      if (document.hidden || !/^\/lab\//.test(location.pathname)) { stopAudio(); return; }
      audio.src = new URL(line.audio, location.origin).href; applyAudioSettings();
      narration = {lab: line}; root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
      labBubble.querySelector('p').textContent = [...line.text][0]; labBubble.setAttribute('aria-label', line.text); labBubble.hidden = false;
      clearTimeout(reactionTimer); setPresence('speaking'); setExpression('happy'); gesture('nod');
      await audio.play();
      if (labVoiceRun !== run) return;
      callbacks.onStart?.(line); if (!animationFrame) animatePlayback();
    } catch (error) { if (labVoiceRun === run) failLabVoice(error); }
  }
  function animatePlayback(time = 0) {
    if (document.hidden || (!pcmPlayback && (!audio || audio.paused))) return;
    animationFrame = requestAnimationFrame(animatePlayback);
    if (time - lastTick < 50) return; lastTick = time;
    if (pcmPlayback) {
      const playing = pcmPlayback, clock = audioContext.currentTime; let played = 0;
      for (const span of playing.spans) { if (clock < span.time) break; played = span.offset + Math.min(span.duration, clock - span.time); }
      for (const sentence of playing.sentences.values()) {
        if (sentence.words.length && played * 1000 >= sentence.words[0].begin_time && playing.activeSentence !== sentence && played * 1000 <= (sentence.endTime ?? Infinity)) {
          playing.activeSentence = sentence; setExpression(expressionFor(sentence.text, playing.view.mood));
        }
      }
      // Web Audio's source-ended event uses the rendering clock. Leave the
      // output device's queued tail time to drain before navigation/cleanup.
      const outputDelay = (audioContext.baseLatency || 0) + (audioContext.outputLatency || 0) + .04;
      if (playing.finished && !playing.sources.size && !playing.pending.length && clock >= playing.nextTime + outputDelay) { completePlayback(); return; }
    } else if (narration?.view && Number.isFinite(audio.duration) && audio.duration > 0) {
      // Use the media clock, so buffering and slower devices cannot race ahead.
      const progress = Math.min(1, audio.currentTime / audio.duration);
      revealReply(narration.view, Math.max(1, Math.ceil(narration.view.characters.length * progress)));
    } else if (narration?.lab && Number.isFinite(audio.duration) && audio.duration > 0) {
      const characters = [...narration.lab.text];
      const subtitle = characters.slice(0, Math.max(1, Math.ceil(characters.length * audio.currentTime / audio.duration))).join('');
      labBubble.querySelector('p').textContent = subtitle; labVoiceRun?.callbacks.onProgress?.(subtitle);
    } else if (narration?.article && Number.isFinite(audio.duration) && audio.duration > 0) {
      const characters = [...narration.article.text];
      articleBubble.querySelector('p').textContent = characters.slice(0, Math.max(1, Math.ceil(characters.length * audio.currentTime / audio.duration))).join('');
    }
    if (reducedMotion()) { mouth = 0; smoothedEnergy = 0; setFrame(); return; }
    let rms = 0;
    if (analyser && samples && audioContext?.state === 'running') {
      analyser.getFloatTimeDomainData(samples);
      let energy = 0; for (const value of samples) energy += value * value;
      rms = Math.sqrt(energy / samples.length);
    } else {
      const cached = narration?.welcome ? config.welcome : narration?.article || narration?.lab;
      if (cached) rms = cached.envelope?.[Math.floor(audio.currentTime / (cached.step || .05))] || 0;
    }
    smoothedEnergy = smoothedEnergy * .65 + rms * .35;
    const target = smoothedEnergy < .018 ? 0 : Math.min(sprite().mouthFrames.length - 1, Math.round(smoothedEnergy / .14 * (sprite().mouthFrames.length - 1)));
    if (target !== mouth && time - lastMouthChange >= 80) {
      mouth += Math.sign(target - mouth) * Math.min(2, Math.abs(target - mouth)); lastMouthChange = time; setFrame();
    }
  }
  function applyAudioSettings() {
    if (!audio) return;
    audio.playbackRate = 1;
    audio.preservesPitch = true;
  }
  function prepareAudio(withAnalyser = false) {
    if (!audio) {
    audio = new Audio(); audio.preload = 'auto';
    audio.addEventListener('pause', () => {
      if (pcmPlayback) return;
      if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; mouth = 0; smoothedEnergy = 0; lastTick = 0; lastMouthChange = 0; setFrame();
    });
    audio.addEventListener('playing', () => {
      if (narration && (opened || narration.welcome || narration.article || narration.lab) && !document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; lastTick = 0; animatePlayback();
      }
    });
    audio.addEventListener('ended', () => { if (!pcmPlayback && root.classList.contains('cp-playing')) completePlayback(); });
    audio.addEventListener('error', () => { if (labVoiceRun && narration?.lab) { failLabVoice(new Error('这段音频没有加载成功，请重试或阅读后答题。')); return; } if (!pcmPlayback && root.classList.contains('cp-playing')) { const ambient = narration?.welcome || narration?.article; stopAudio(); if (!ambient) report('咦，声音没出来，旅行者先看看这句话吧。'); } });
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (withAnalyser && Context && !audioContext) {
      try { audioContext = new Context(); analyser = audioContext.createAnalyser(); analyser.fftSize = 1024; samples = new Float32Array(analyser.fftSize);
        const source = audioContext.createMediaElementSource(audio); source.connect(analyser); analyser.connect(audioContext.destination);
      } catch (_) { analyser = null; }
    }
  }
  function primeAudio() {
    // Unlock the same audio element/context synchronously during the Send gesture.
    prepareAudio(true);
    audioContext?.resume().catch(() => {});
    const silence = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';
    audio.src = silence;
    audio.play().then(() => { if (audio.src === silence) audio.pause(); }).catch(() => {});
  }
  function receiveStream(data, view, ticket) {
    if(data.type==='reading-status'){state(data.status==='summarizing'?'正在读全文，第 '+data.current+' / '+data.total+' 组…':'正在读'+(data.label||'相关原文')+'…');return;}
    if (data.type === 'study') renderStudy(data.study);
    if (data.result && Object.hasOwn(data.result, 'study')) renderStudy(data.result.study);
    if (data.type === 'text') {
      view.hasTextStream = true; view.message.text = data.text; view.characters = [...data.text];
      revealReply(view, view.characters.length);
    }
    if (data.type === 'phrase' && !view.hasTextStream) {
      view.message.text = (view.message.text || '') + data.text; view.characters = [...view.message.text];
      revealReply(view, view.characters.length);
    }
    if (data.result) { view.message = data.result; view.characters = [...data.result.text]; updateLimits(data.result.limits); }
    if (data.type === 'text-end' || data.result) finishReply(view);
    if (ticket !== playbackTicket || !opened || document.hidden) { if (data.result) finishReply(view); return; }
    if (data.type === 'voice-status' && !root.classList.contains('cp-playing')) {
      view.voiceStatus = data.status;
      state(data.status === 'resuming' ? '声音正在从上一句接着准备…' : data.status === 'reconnecting' ? '声音连接有点慢，正在重连…' : '可莉正在准备声音…');
    }
    if (data.type === 'text-end' && !root.classList.contains('cp-playing')) state(view.voiceStatus === 'reconnecting' ? '声音连接有点慢，正在重连…' : '文字好了，声音正在准备…');
    if (data.type === 'start' || (!pcmPlayback && ['audio','alignment'].includes(data.type))) {
      if (!audioContext || !analyser) throw new Error('咦，声音没出来，旅行者先看看这句话吧。');
      pcmPlayback = {view, sources: new Set(), spans: [], sentences: new Map(), pending: [], pendingSamples: 0, offset: 0, nextTime: 0, finished: false};
      narration = {view};
    }
    const playing = pcmPlayback;
    if (data.type === 'alignment' && playing) {
      const output = data.output, index = output.sentence?.index; if (!Number.isInteger(index)) return;
      let sentence = playing.sentences.get(index);
      if (!sentence) {
        const offset = [...playing.sentences.values()].reduce((sum, item) => sum + [...item.text].length, 0);
        sentence = {text: output.original_text || '', offset, words: [], endTime: null}; playing.sentences.set(index, sentence);
      }
      if (output.original_text) sentence.text = output.original_text;
      if (output.sentence.words?.length) {
        let cursor = 0;
        sentence.words = output.sentence.words.map(word => {
          const at = sentence.text.indexOf(word.text, cursor);
          const end = at >= 0 ? at + word.text.length : cursor;
          cursor = end; return {...word, characterEnd: [...sentence.text.slice(0, end)].length};
        });
      }
      if (output.type === 'sentence-end') sentence.endTime = Math.max(...sentence.words.map(word => word.end_time), playing.offset * 1000);
    }
    if (data.type === 'audio' && playing) {
      const bytes = Uint8Array.from(atob(data.data), value => value.charCodeAt(0));
      if (bytes.length % 2) throw new Error('可莉的声音断了一下。');
      const samples = new Float32Array(bytes.length / 2), values = new DataView(bytes.buffer);
      for (let index = 0; index < samples.length; index++) samples[index] = values.getInt16(index * 2, true) / 32768;
      playing.pending.push(samples); playing.pendingSamples += samples.length;
      if (playing.pendingSamples >= 2880) flushPCM(playing);
    }
    if(data.type === 'audio-trim' && playing) trimPCM(playing,data.offsetMs);
    if (data.type === 'done' || data.type === 'error') {
      view.canAct = data.type === 'done' && !data.replayed && !data.textOnly;
      if (playing) { flushPCM(playing); playing.finished = true; }
      if (data.textOnly || !playing?.spans.length) { stopAudio(); finishReply(view); }
      if (data.type === 'error') {
        if(playing && pcmPlayback===playing && playing.sources.size){
          // The provider can fail long before the queued audio reaches the
          // speaker. Let it drain before showing the final failure/retry UI.
          playing.failure=data.error;state('正在播放已收到的声音…');
        }else{report(data.error);offerVoiceRetry(view);}
      }
      else { report(''); if (data.textOnly) offerVoiceRetry(view); }
    }
  }
  function trimPCM(playing,offsetMs) {
    if(!Number.isFinite(offsetMs) || offsetMs<0 || offsetMs/1000>playing.offset+playing.pendingSamples/24000+.001)throw new Error('语音续读位置无效。');
    const cutoff=offsetMs/1000,clock=audioContext.currentTime;
    playing.pending=[];playing.pendingSamples=0;
    let nextTime=clock+.06;
    for(const span of playing.spans){
      if(span.offset>=cutoff){try{span.source.stop();}catch{}playing.sources.delete(span.source);}
      else if(span.offset+span.duration>cutoff){
        span.duration=cutoff-span.offset;nextTime=Math.max(nextTime,span.time+span.duration);
        try{span.source.stop(Math.max(clock,span.time+span.duration));}catch{}
      }else nextTime=Math.max(nextTime,span.time+span.duration);
    }
    playing.spans=playing.spans.filter(span=>span.offset<cutoff);playing.offset=cutoff;playing.nextTime=nextTime;
    for(const [index,sentence] of playing.sentences)if(sentence.endTime===null || sentence.endTime>offsetMs)playing.sentences.delete(index);
    playing.activeSentence=null;
  }
  function flushPCM(playing) {
    if (!playing.pendingSamples) return;
    const buffer = audioContext.createBuffer(1, playing.pendingSamples, 24000), target = buffer.getChannelData(0); let offset = 0;
    for (const part of playing.pending) { target.set(part, offset); offset += part.length; }
    playing.pending = []; playing.pendingSamples = 0;
    const source = audioContext.createBufferSource(); source.buffer = buffer; source.connect(analyser);
    const start = Math.max(playing.nextTime, audioContext.currentTime + (playing.nextTime ? .015 : .06));
    playing.spans.push({time: start, offset: playing.offset, duration: buffer.duration,source});
    playing.offset += buffer.duration; playing.nextTime = start + buffer.duration; playing.sources.add(source);
    source.onended = () => { playing.sources.delete(source); source.disconnect(); };
    source.start(start);
    if (!root.classList.contains('cp-playing')) {
      root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
      clearTimeout(reactionTimer); setPresence('speaking'); setExpression(expressionFor(playing.view.message.text || '', playing.view.mood));
      gesture(expression === 'happy' || expression === 'laugh' || expression === 'proud' ? 'bounce' : 'nod');
      state('可莉有话想说！'); lastTick = 0; animatePlayback();
    }
  }
  async function playSpeech(message, view, ticket) {
    if (!service?.voice) throw new Error('女声服务还没有连接好，文字聊天可以继续使用。');
    if (message.speechError) throw new Error(message.speechError);
    state('嘿嘿，马上就好。'); report('');
    const cacheKey = message.id;
    let cached = audioCache.get(cacheKey);
    if (!cached) {
      const blob = message.audioBlob;
      if (!blob) throw new Error('可莉的声音还没传过来，先看看这句话吧。');
      cached = URL.createObjectURL(blob); audioCache.set(cacheKey, cached);
      if (audioCache.size > 10) { const oldest = audioCache.keys().next().value; URL.revokeObjectURL(audioCache.get(oldest)); audioCache.delete(oldest); }
    }
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); return; }
    prepareAudio(true);
    audio.src = cached; applyAudioSettings();
    if (audioContext?.state === 'suspended') await audioContext.resume();
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); return; }
    await audio.play();
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); audio.pause(); return; }
    narration = {view}; revealReply(view, 1);
    root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
    state('可莉有话想说！'); animatePlayback();
  }
  function cancelWelcome() {
    welcomePending = false; clearTimeout(welcomeTimer); if (welcomeBubble) welcomeBubble.hidden = true;
    document.removeEventListener('pointerdown', welcomeGesture); document.removeEventListener('pointerup', welcomeGesture); document.removeEventListener('keydown', welcomeGesture);
  }
  function welcomeGesture(event) {
    if (event.type === 'keydown' && (event.ctrlKey || event.altKey || event.metaKey)) return;
    if (event.target.closest?.('.cp-welcome-close,.cp-icon,.cp-stop,.cp-form button')) return;
    tryWelcome(true);
  }
  function tryWelcome(withUserGesture = false) {
    if (!welcomePending || welcomeStarting || busy || narration || document.hidden) return;
    welcomeStarting = true; const ticket = playbackTicket;
    prepareAudio(withUserGesture); if (withUserGesture) audioContext?.resume().catch(() => {});
    const url = new URL(config.welcome.audio, location.origin).href;
    if (audio.src !== url) audio.src = url;
    audio.play().then(() => {
      if (ticket !== playbackTicket || busy || document.hidden) { audio.pause(); return; }
      cancelWelcome(); try { localStorage.setItem(welcomeKey, 'true'); } catch (_) {}
      narration = {welcome: true}; root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
      clearTimeout(reactionTimer); setPresence('speaking'); setExpression('happy'); gesture('hello');
      welcomeBubble.hidden = opened; state('可莉来啦！'); animatePlayback();
    }).catch(error => { if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') cancelWelcome(); }).finally(() => { welcomeStarting = false; });
  }
  function startWelcome() {
    if (!config.welcome?.audio) return;
    try { if (localStorage.getItem(welcomeKey) === 'true') return; } catch (_) {}
    welcomedThisPage = true; welcomePending = true; welcomeBubble.hidden = false;
    prepareAudio(); audio.src = new URL(config.welcome.audio, location.origin).href; audio.load();
    document.addEventListener('pointerdown', welcomeGesture); document.addEventListener('pointerup', welcomeGesture); document.addEventListener('keydown', welcomeGesture);
    tryWelcome();
  }
  function articlePath() {
    return location.pathname.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
  }
  function readArticleHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem(articleKey) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) articleHistory = stored;
    } catch (_) { /* Keep the in-memory cooldown if storage is unavailable. */ }
    const day = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (articleHistory.day !== day) articleHistory = {day, count: 0, paths: [], topics: [], lastAt: Number(articleHistory.lastAt) || 0};
    if (!Array.isArray(articleHistory.paths)) articleHistory.paths = [];
    if (!Array.isArray(articleHistory.topics)) articleHistory.topics = [];
    return articleHistory;
  }
  function canApproachArticle(visit) {
    if (articleVisit !== visit || visit.cancelled || visit.starting || document.hidden || opened || busy || narration || welcomePending || welcomeStarting) return false;
    if (document.querySelector('input:focus,textarea:focus,[contenteditable=true]:focus') || window.getSelection()?.toString()) return false;
    return ![...document.querySelectorAll('audio,video')].some(media => !media.paused && !media.ended && !media.muted && media.volume > 0);
  }
  function articleAvailable(visit) {
    const history = readArticleHistory(), policy = config.article;
    return (Number(history.count) || 0) < policy.dailyLimit
      && Date.now() - (Number(history.lastAt) || 0) >= policy.cooldownMs
      && !history.paths?.includes(visit.path) && !history.topics?.includes(visit.topic);
  }
  function cancelArticle() {
    clearTimeout(articleTimer); articleTimer = null;
    removeArticleUnlock();
    if (articleVisit) articleVisit.cancelled = true;
    if (narration?.article || articleVisit?.starting) stopAudio();
    clearTimeout(articleBubbleTimer); if (articleBubble) articleBubble.hidden = true;
  }
  function removeArticleUnlock() {
    for (const event of ['pointerup', 'touchend', 'keydown']) document.removeEventListener(event, unlockArticleAudio);
  }
  function unlockArticleAudio(event) {
    if (!event.isTrusted || !articleVisit || !canApproachArticle(articleVisit)) return;
    if (event.type === 'keydown' && (event.ctrlKey || event.altKey || event.metaKey)) return;
    removeArticleUnlock(); primeAudio();
  }
  async function approachArticle(visit, line) {
    const start = async () => {
      if (!canApproachArticle(visit) || !articleAvailable(visit) || articlePath() !== visit.path) return;
      // Reserve once before playback, including text-only autoplay fallback.
      const history = readArticleHistory();
      Object.assign(history, {count: (Number(history.count) || 0) + 1, lastAt: Date.now(),
        paths: [...(Array.isArray(history.paths) ? history.paths : []), visit.path],
        topics: [...(Array.isArray(history.topics) ? history.topics : []), visit.topic]});
      try { localStorage.setItem(articleKey, JSON.stringify(history)); } catch (_) {}
      visit.starting = true; const ticket = playbackTicket;
      articleBubble.setAttribute('aria-label', line.text);
      prepareAudio(); audio.src = new URL(line.audio, location.origin).href; applyAudioSettings();
      audioContext?.resume().catch(() => {});
      try {
        await audio.play();
        if (articleVisit !== visit || visit.cancelled || ticket !== playbackTicket || document.hidden || opened || busy) { audio.pause(); return; }
        narration = {article: line}; root.classList.add('cp-playing');
        articleBubble.querySelector('p').textContent = [...line.text][0]; articleBubble.hidden = false;
        clearTimeout(reactionTimer); setPresence('speaking'); setExpression(line.mood || 'happy'); gesture('nod'); animatePlayback();
      } catch (error) {
        if (articleVisit !== visit || visit.cancelled || ticket !== playbackTicket || document.hidden || opened || busy) return;
        // Browsers may block unsolicited audio. Show the one short line without a later surprise replay.
        if (error.name === 'NotAllowedError') {
          articleBubble.querySelector('p').textContent = line.text; articleBubble.hidden = false;
          setExpression(line.mood || 'happy'); gesture('nod'); settleCharacter();
          articleBubbleTimer = setTimeout(() => { articleBubble.hidden = true; }, 9000);
        }
      } finally { visit.starting = false; }
    };
    // Two open tabs share a cooldown; serialize the check and reservation when supported.
    try { if (navigator.locks) await navigator.locks.request(articleKey, start); else await start(); } catch (_) {}
  }
  async function startArticle() {
    cancelArticle();
    const policy = config.article;
    if (!policy?.enabled || welcomedThisPage || document.hidden || opened || !document.querySelector('#post #article-container')) return;
    const visit = {path: articlePath(), entered: performance.now(), cancelled: false}; articleVisit = visit;
    if (!articleManifestPromise) articleManifestPromise = fetch(policy.manifest, {cache: 'no-cache'})
      .then(response => { if (!response.ok) throw new Error('Unavailable article lines'); return response.json(); })
      .catch(() => { articleManifestPromise = null; return null; });
    const manifest = await articleManifestPromise;
    if (!manifest || articleVisit !== visit || visit.cancelled) return;
    visit.topic = manifest.articles[visit.path]; const line = manifest.lines[visit.topic];
    if (!line?.audio || !articleAvailable(visit) || Math.random() >= policy.probability) return;
    for (const event of ['pointerup', 'touchend', 'keydown']) document.addEventListener(event, unlockArticleAudio, {passive: true});
    articleTimer = setTimeout(() => { articleTimer = null; removeArticleUnlock(); approachArticle(visit, line); }, Math.max(0, policy.delayMs - (performance.now() - visit.entered)));
  }
  function build() {
    root = node('aside', 'companion'); root.setAttribute('aria-label', config.name + '陪伴助手'); root.dataset.presence = 'idle';
    const avatar = (interactive = false) => {
      const wrap = interactive ? button('', 'cp-avatar-wrap cp-character', greetCharacter) : node('div', 'cp-avatar-wrap');
      if (interactive) wrap.setAttribute('aria-label', '和可莉打个招呼');
      const el = node('div', 'cp-avatar'); el.setAttribute('aria-hidden', 'true'); el.style.backgroundImage = 'url(' + JSON.stringify(new URL(config.avatar, location.origin).href) + ')';
      const atlas = sprite(); el.style.backgroundSize = `${atlas.columns * 100}% ${atlas.rows * 100}%`;
      if (config.expressions) {
        const faces = config.expressions, eye = faces.eyeCenter || atlas.eyeCenter, lip = faces.mouthCenter || atlas.mouthCenter;
        for (const className of ['cp-face-back','cp-face-front']) {
          const layer = node('span', 'cp-expression-layer ' + className);
          layer.style.setProperty('--cp-expression-image', 'url(' + JSON.stringify(new URL(faces.atlas, location.origin).href) + ')');
          layer.style.setProperty('--cp-expression-size', `${faces.columns * 100}% ${faces.rows * 100}%`);
          layer.style.setProperty('--cp-expression-position', framePosition(0, faces));
          const eyes = node('span', 'cp-expression-eyes'), lips = node('span', 'cp-expression-mouth');
          eyes.style.maskImage = `radial-gradient(ellipse 27% 12% at ${eye[0]}% ${eye[1]}%, #000 80%, transparent 100%)`;
          lips.style.maskImage = `radial-gradient(ellipse 8% 6% at ${lip[0]}% ${lip[1]}%, #000 82%, transparent 100%)`;
          layer.append(eyes, lips); el.append(layer);
        }
      }
      const lips = node('span', 'cp-mouth'), eyes = node('span', 'cp-eyes'); lips.hidden = true; eyes.hidden = true;
      lips.style.clipPath = `ellipse(8% 6% at ${atlas.mouthCenter[0]}% ${atlas.mouthCenter[1]}%)`;
      eyes.style.clipPath = `ellipse(23% 9% at ${atlas.eyeCenter[0]}% ${atlas.eyeCenter[1]}%)`;
      el.append(lips, eyes); const breath = node('span', 'cp-breath'); breath.append(el); wrap.append(breath); return wrap;
    };
    const launcher = button('', 'cp-launcher', () => setOpen(true)); launcher.setAttribute('aria-label', '与' + config.name + '聊天'); launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'companion-panel'); launcher.append(avatar(), node('span', 'cp-launcher-label', '来找可莉玩！'));
    const panel = node('section', 'cp-panel'); panel.id = 'companion-panel'; panel.hidden = true; panel.setAttribute('aria-label', '聊天面板');
    const header = node('header', 'cp-header'); const title = node('div', 'cp-title', config.name); title.append(node('small', '', '火花骑士'));
    const close = button('×', 'cp-icon', () => setOpen(false)); close.setAttribute('aria-label', '关闭聊天'); header.append(title, close);
    const intro = node('div', 'cp-intro'); const copy = node('div', 'cp-intro-copy'); copy.append(node('strong', '', '一起去玩吧！'), node('span', 'cp-state', '嘟嘟可也在听。'));
    const stop = button('先停一下', 'cp-stop', () => { stopAudio(); state('可莉在听呢！'); }); stop.setAttribute('aria-label', '停止播放'); stop.hidden = true; copy.append(stop); intro.append(avatar(true), copy);
    quota = node('span', 'cp-quota');
    messageList = node('div', 'cp-messages'); messageList.dataset.cpView = 'chat'; messageList.setAttribute('role', 'log'); messageList.setAttribute('aria-live', 'polite'); messageList.setAttribute('aria-label', '聊天记录');
    const dataButtons = node('div', 'cp-data-buttons');
    if (config.reading?.enabled) {
      const start = button('一起学这篇', '', () => {
        if (!readingContext()) { report('先打开想学的文章，再一起读吧！'); return; }
        studyPrompt('带我用十五分钟一步步学懂这篇文章');
      });
      start.dataset.studyPrompt = 'start';
      const resume = button('接着上次学', '', () => studyPrompt('继续上次学习')); resume.dataset.studyPrompt = 'resume';resume.hidden=true;
      const pause = button('先休息一下', '', () => studyPrompt('暂停学习')); pause.dataset.studyPrompt = 'pause';pause.hidden=true;
      dataButtons.append(start, resume, pause);
    }
    if(config.reading?.enabled)dataButtons.append(button('概括本节','',()=>studyPrompt('概括当前这一节')),button('概括全文','',()=>studyPrompt('概括整篇文章的主要内容')));
    if (config.reading?.enabled) dataButtons.append(button('稍后阅读', '', showReadLater), button('收藏这篇文章', '', async () => {
      const reading = readingContext();
      if (!reading) { report('先打开一篇文章，再一起收藏吧。'); return; }
      try { await ensureSession(); await request('/bookmarks', 'POST', {reading: {path: reading.path}}); report('好耶，可莉记到稍后阅读里啦！'); }
      catch (error) { report(error.message); }
      root.querySelector('.cp-options').open = false;
    }));
    dataButtons.append(button('导出我的数据', '', async () => {
      try { await ensureSession(); const data = await request('/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
        const a = node('a'); a.href = url; a.download = 'companion-memory.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { report(error.message); }
    }), button('清空对话', '', async () => {
      if (!window.confirm('清空聊天、记忆、学习进度和稍后阅读，重新开始吗？')) return;
      try { await ensureSession(); const result = await request('/reset', 'DELETE'); messageList.replaceChildren(); welcome();
        audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); stopAudio(); readingSelection = ''; readingList.replaceChildren(); renderStudy(null); showChat(); updateLimits(result.limits); report('好耶，我们重新开始吧！');
      } catch (error) { report(error.message); }
    }));
    notice = node('p', 'cp-notice'); notice.hidden = true; notice.setAttribute('role', 'status');
    form = node('form', 'cp-form'); textarea = node('textarea'); textarea.maxLength = 1200; textarea.rows = 2; textarea.placeholder = '想和可莉说什么？'; textarea.setAttribute('aria-label', '聊天消息');
    readingList = node('section', 'cp-reading-list'); readingList.hidden = true; readingList.setAttribute('aria-label', '稍后阅读');
    studyBox = node('section', 'cp-study'); studyBox.hidden = true; studyBox.setAttribute('aria-label', '一起学习');
    selectionBox = node('div', 'cp-selection'); selectionBox.hidden = true;
    const clearSelection = button('×', '', () => { readingSelection = ''; updateSelection(); }); clearSelection.setAttribute('aria-label', '取消选中内容');
    selectionBox.append(node('span'),button('解释','',()=>studyPrompt('解释选中这段内容')),button('概括','',()=>studyPrompt('概括选中这段内容')), clearSelection);
    send = node('button', 'cp-primary', '告诉可莉'); send.type = 'submit'; form.append(textarea, send); form.addEventListener('submit', submit);
    textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    textarea.addEventListener('input', () => {
      if (busy || narration) return;
      clearTimeout(reactionTimer); setPresence('listening'); setExpression(textarea.value.trim() ? 'curious' : 'neutral'); settleCharacter();
    });
    const options = node('details', 'cp-options'), summary = node('summary', '', '⋯'), menu = node('div', 'cp-options-menu');
    summary.setAttribute('aria-label', '聊天选项'); menu.append(dataButtons, quota); options.append(summary, menu); header.insertBefore(options, close);
    welcomeBubble = node('div', 'cp-welcome'); welcomeBubble.hidden = true; welcomeBubble.append(node('p', '', config.greeting), button('×', 'cp-welcome-close', () => {
      cancelWelcome(); stopAudio(); try { localStorage.setItem(welcomeKey, 'true'); } catch (_) {}
    }));
    welcomeBubble.querySelector('button').setAttribute('aria-label', '停止欢迎语');
    articleBubble = node('div', 'cp-article'); articleBubble.hidden = true; articleBubble.setAttribute('role', 'status'); articleBubble.setAttribute('aria-live', 'polite');
    const dismissArticle = button('×', 'cp-article-close', cancelArticle); dismissArticle.setAttribute('aria-label', '停止搭话');
    const articleText = node('p'); articleText.setAttribute('aria-hidden', 'true'); articleBubble.append(articleText, dismissArticle);
    labBubble = node('div', 'cp-lab'); labBubble.hidden = true; labBubble.setAttribute('role', 'status');
    const labText = node('p'); labText.setAttribute('aria-hidden', 'true');
    const dismissLab = button('×', 'cp-article-close', stopAudio); dismissLab.setAttribute('aria-label', '暂停算法讲解'); labBubble.append(labText, dismissLab);
    panel.append(header, intro, studyBox, messageList, readingList, selectionBox, notice, form); root.append(welcomeBubble, articleBubble, labBubble, launcher, panel); document.body.append(root);
    window.KleeLabVoice = {play: playLabVoice, stop: owner => { if (labVoiceRun?.owner === owner) stopAudio(); }};
    document.addEventListener('selectionchange', captureSelection);
    welcome(); updateLimits(); setExpression('neutral'); scheduleBlink();
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (opened) setOpen(false); else cancelArticle(); } });
    const pauseCharacter = () => {
      clearTimeout(reactionTimer); clearTimeout(gestureTimer); clearTimeout(blinkTimer);
      root.dataset.gesture = ''; setPresence(document.hidden ? 'hidden' : 'idle'); setExpression('neutral'); blinkStep = 0; setFrame();
      root.querySelectorAll('.cp-expression-layer').forEach(layer => layer.getAnimations().forEach(animation => animation.cancel()));
      root.querySelectorAll('.cp-face-back').forEach(layer => { layer.style.opacity = '0'; });
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelArticle(); stopAudio(); pauseCharacter(); } else { setPresence('idle'); scheduleBlink(); tryWelcome(); } });
    document.addEventListener('pjax:send', () => { cancelArticle(); stopAudio(); pauseCharacter(); readingSelection = ''; updateSelection(); });
    document.addEventListener('pjax:complete', () => { if (!root.isConnected) document.body.append(root); welcomedThisPage = false; scheduleBlink(); startArticle(); });
    window.addEventListener('pagehide', () => { cancelArticle(); stopAudio(); pauseCharacter(); audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); });
    window.addEventListener('pageshow', event => { setPresence(root.classList.contains('cp-playing') ? 'speaking' : busy ? 'thinking' : 'idle'); scheduleBlink(); if (event.persisted) startArticle(); });
    document.addEventListener('play', event => { if (event.target instanceof HTMLMediaElement && !event.target.muted && event.target.volume > 0) { cancelArticle(); if (event.target !== audio && labVoiceRun) stopAudio(); } }, true);
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
      clearTimeout(blinkTimer); blinkStep = 0; clearTimeout(gestureTimer); mouth = 0; lastMouthChange = 0; root.dataset.gesture = ''; setFrame();
      root.querySelectorAll('.cp-expression-layer').forEach(layer => layer.getAnimations().forEach(animation => animation.cancel()));
      root.querySelectorAll('.cp-face-back').forEach(layer => { layer.style.opacity = '0'; });
      if (!reducedMotion()) scheduleBlink();
    });
    const connect = node('link'); connect.rel = 'preconnect'; connect.href = apiBase; document.head.append(connect);
    ensureHealth().catch(() => {}); startWelcome(); startArticle();
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
