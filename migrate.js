// 一次性数据迁移脚本：将 entries.json 数据迁移到 MySQL（通过 .NET 后端 API）
// 使用前确保 .NET 后端在 http://127.0.0.1:8090 运行中
// 执行：node migrate.js

const API = 'http://127.0.0.1:8090';

const entries = [
  {
    "id": 1774696682277,
    "question": "What's your view on social media? Is it mostly good or bad?",
    "original": "Wow. About social media I think.  It has a good aspect. And it also has a father's belt. Aspect. It can spray the things. Quickly. It is. Conductive. For news. Report. But for some personal things. And some fake news. We can't control him to spray. So we must.合理的 use The social media.",
    "spoken": "Wow, about social media, I think it has both good and bad sides. For example, it can spread information quickly, which is really useful for news reports. But when it comes to personal things or fake news, it's hard to control how it spreads. So we need to use social media wisely.",
    "translation": "哇，说到社交媒体，我觉得它有好的一面也有不好的一面。比如，它可以很快传播信息，这对新闻报道很有用。但对于个人隐私或假新闻，它的传播很难控制。所以我们需要明智地使用社交媒体。",
    "analysis": "- social media - 社交媒体  \n- aspect - 方面，层面  \n- spread information - 传播信息  \n- fake news - 假新闻  \n- control - 控制  \n- wisely - 明智地",
    "corrections": "- \"About social media I think.\" → \"Wow, about social media, I think...\" - 原句感觉过于生硬和碎裂，加上 \"Wow\" 可以使听起来更自然流畅。\n- \"It has a good aspect. And it also has a father's belt. Aspect.\" → \"It has both good and bad sides.\" - \"father's belt\" 可能是错误的用词，改为更合适的表达\"good and bad sides\"。\n- \"It can spray the things. Quickly. It is. Conductive. For news. Report.\" → \"It can spread information quickly, which is really useful for news reports.\" - 原句不通顺，也有多个拼写和语法问题，改为更连贯的表达方式。\n- \"We can't control him to spray.\" → \"It's hard to control how it spreads.\" - 原句错误使用了\"him\"和\"spray\"，改为更精确表达。\n- \"So we must.合理的 use The social media.\" → \"So we need to use social media wisely.\" - 把\"合理的\"翻译成\"wisely\"，更适合这里的语境。",
    "color": null,
    "timestamp": "2026-03-28T11:18:02.277Z"
  },
  {
    "id": 1774695333690,
    "question": "What do you think about working from home vs. working in an office?",
    "original": "I quite like working at home. Of course. I think the traffic. Often calls to my. Toy. A lot of time. Work at home can reduce the west of the public resource. And walking in the whole face. Have a. Great aspect. It makes people more concentrate in. Their work. People will do the job efficient. And. Save. Time. Connect with. Work mate. And easy to join the meeting. And will. It has to. Emotion with. Work mate.",
    "spoken": "\"I really like working from home. Honestly, it's a huge time-saver—no more dealing with traffic or wasting time commuting. Plus, it reduces the strain on public resources. Working from home also has a personal touch: it's quieter, which helps me focus better and be more productive. Meetings are easier to join online, and I can still stay connected with my coworkers in a practical way. Overall, it brings a great balance of efficiency and freedom.\"",
    "translation": "我真的很喜欢在家工作。说实话，这省了很多时间——不再需要面对交通问题或浪费时间通勤了。另外，这还能减轻对公共资源的压力。在家工作的另一个优势是，它更安静，能让我更专注、更高效地完成工作。线上会议更方便，我也能以一种更务实的方式与同事保持联系。总的来说，这种工作方式在效率和自由之间达到了很好的平衡。",
    "analysis": "- working from home - 在家工作  \n- time-saver - 节省时间的事物  \n- reduce the strain on public resources - 减轻对公共资源的压力  \n- focus better - 更好地集中注意力  \n- be more productive - 更加高效  \n- stay connected - 保持联系  \n- practical way - 切实可行的方式  \n- balance of efficiency and freedom - 效率与自由的平衡",
    "corrections": "1. \"I quite like working at home.\" → \"I quite like working from home.\" - \"working at home\" 应改为 \"working from home\"，更符合英语表达习惯。\n2. \"I think the traffic. Often calls to my. Toy. A lot of time.\" → \"I think the traffic often wastes a lot of my time.\" - 原句存在多个碎片化短句，语法混乱。\n3. \"Work at home can reduce the west of the public resource.\" → \"Working from home can reduce the strain on public resources.\" - 拼写错误\"west\" 应为\"waste\"。\n4. \"It makes people more concentrate in.\" → \"It helps people concentrate more.\" - 动词形态错误。\n5. \"People will do the job efficient.\" → \"People will do their job more efficiently.\" - 形容词\"efficient\"应改为副词\"efficiently\"。\n6. \"And easy to join the meeting.\" → \"and it's easy to join meetings online.\" - 添加主语。\n7. \"And will. It has to. Emotion with. Work mate.\" → \"And it even helps maintain good relationships with coworkers.\" - 原句不清晰，需整体改写。",
    "color": null,
    "timestamp": "2026-03-28T10:55:33.690Z"
  },
  {
    "id": 1774686750552,
    "question": "What's your favorite season?",
    "original": "I love fall ,it's not too cold and not too hot ,and the sence is very beautiful , full of yellow leafs.",
    "spoken": "I love autumn; it's not too chilly or too warm, and the scenery is absolutely gorgeous with all the golden leaves.",
    "translation": "我喜欢秋天；天气不太冷也不太热，景色非常迷人，到处都是金黄色的树叶。",
    "analysis": "- autumn - 秋天  \n- chilly - 微冷的；凉爽的  \n- warm - 温暖的  \n- scenery - 景色；风景  \n- gorgeous - 非常漂亮的；迷人的  \n- golden leaves - 金黄色的树叶",
    "corrections": "\"I love fall ,it's not too cold and not too hot ,and the sence is very beautiful , full of yellow leafs.\" → \"I love fall; it's not too cold or too hot, and the scenery is very beautiful, full of yellow leaves.\" - 应当使用分号（;）而不是逗号（,）；\"sence\"是拼写错误，应更正为\"scenery\"；\"leafs\"应更正为\"leaves\"（复数形式）。",
    "color": null,
    "timestamp": "2026-03-28T08:32:30.552Z"
  },
  {
    "id": 1774686289267,
    "question": "Coffee or tea?",
    "original": "definitely tea ,it's Light and freshing.",
    "spoken": "I'd definitely go for tea—it's light and refreshing!",
    "translation": "我肯定选茶——它很清淡又提神！",
    "analysis": "- definitely - 肯定地，毫无疑问  \n- go for - 选择某事/某物  \n- tea - 茶  \n- light - 清淡的，轻的  \n- refreshing - 提神的，使人精神焕发的",
    "corrections": "\"definitely tea ,it's Light and freshing.\" → \"definitely tea, it's light and refreshing.\" - 修正了不需要的空格、大小写错误以及单词\"freshing\"拼写不正确，应为\"refreshing\"。",
    "color": null,
    "timestamp": "2026-03-28T08:24:49.267Z"
  },
  {
    "id": 1774683755069,
    "question": "Do you like dogs or cats more?",
    "original": "I'm more like a dog. Uh, in my opinion. Dog is more loyalty. The cat. And. I love 遛狗， The cat  Don't always follow people. plus, I like to  Big animal.",
    "spoken": "I'm more of a dog person, you know. I think dogs are more loyal than cats. Also, I love walking dogs! Cats don't always follow people around, and besides, I prefer bigger animals.",
    "translation": "我更喜欢狗，你知道吗。我觉得狗比猫更忠诚。而且，我喜欢遛狗！猫并不总是跟着人。另外，我更喜欢体型大的动物。",
    "analysis": "- more like - 更像，更倾向于\n- loyal - 忠诚的\n- walking dogs - 遛狗\n- follow people - 跟随人\n- prefer - 更喜欢",
    "corrections": "- 'I'm more like a dog' → 'I'm more of a dog person' - more like a dog 听起来像在说我像条狗，其实应该表达我更喜欢狗。\n- 'Dog is more loyalty' → 'Dogs are more loyal' - Dog是单数，泛指应用复数Dogs；loyalty是名词，应用形容词loyal。\n- 'The cat. And.' → 'than cats.' - 原句语法不完整，应用than cats完成对比句。\n- '我爱遛狗' → 'I love walking dogs' - 英语中不能夹杂中文。\n- 'plus, I like to Big animal.' → 'besides, I prefer bigger animals.' - 句式不自然，Big animal应用复数。",
    "color": null,
    "timestamp": "2026-03-28T07:42:35.069Z"
  },
  {
    "id": 1774682294672,
    "question": null,
    "original": "Definitely mornings. I love the morning sunlight—it just makes me happy. Plus, I enjoy exercising in the morning. It's a great way to start the day.",
    "spoken": "I definitely love mornings. The morning sunlight makes me so happy, and I really like exercising in the morning. It's such an awesome way to kick off the day.",
    "translation": "我真的特别喜欢早晨。早晨的阳光让我特别开心，我也非常喜欢早晨锻炼。这是开启一天的一个非常棒的方式。",
    "analysis": "- Definitely - 绝对地\n- mornings - 早晨\n- morning sunlight - 早晨的阳光\n- happy - 开心的\n- exercising - 锻炼\n- awesome - 棒的，很好的\n- kick off (the day) - 开始（一天）",
    "corrections": "No issues found",
    "color": null,
    "timestamp": "2026-03-28T07:18:14.672Z"
  },
  {
    "id": 1774675607807,
    "question": null,
    "original": "I think I love morning, definitely. For the first reason, I like exercise of the morning. The sunlight. Make me feel happy. It's good start. Today.",
    "spoken": "I think I definitely love mornings. One big reason is I like exercising in the morning, and the sunlight makes me feel happy. It's such a great way to start the day!",
    "translation": "我觉得我真的很喜欢早晨。一个重要的原因是我喜欢在早晨锻炼，而且阳光让我感到很开心。这样开始一天真的很好！",
    "analysis": "- definitely - 绝对地，确实地\n- mornings - 早晨，清晨\n- exercising - 锻炼，运动\n- sunlight - 阳光\n- happy - 开心，快乐\n- great way - 很棒的方式",
    "corrections": "No corrections recorded",
    "color": "#F8BBD9",
    "timestamp": "2026-03-28T05:26:47.807Z"
  }
];

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('开始数据迁移...\n');

  // 1. 创建分类
  console.log('创建分类 "English"...');
  let category;
  try {
    category = await post('/api/categories', { name: 'English' });
    console.log(`分类创建成功，新 id: ${category.id}\n`);
  } catch (e) {
    console.error('创建分类失败:', e.message);
    process.exit(1);
  }

  // 2. 逐条迁移 entries（按时间顺序，从旧到新）
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let success = 0;
  let failed = 0;

  for (const e of sorted) {
    const preview = e.original.slice(0, 40);
    try {
      await post('/api/entries', {
        question:    e.question || null,
        original:    e.original,
        spoken:      e.spoken,
        translation: e.translation,
        analysis:    e.analysis,
        corrections: e.corrections,
        categoryId:  category.id,
        color:       e.color || null,
        timestamp:   e.timestamp,
      });
      console.log(`✓ ${preview}...`);
      success++;
    } catch (err) {
      console.error(`✗ ${preview}... 失败: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n迁移完成：成功 ${success} 条，失败 ${failed} 条`);
  if (failed === 0) {
    console.log('所有数据已成功迁移到 MySQL！');
    console.log('现在可以打开 React 前端 (http://localhost:5173) 查看笔记。');
  }
}

main().catch(err => {
  console.error('迁移脚本出错:', err);
  process.exit(1);
});
