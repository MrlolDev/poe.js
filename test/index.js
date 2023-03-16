import ChatBot from '../dist/index.js';

(async () => {
  var bot = new ChatBot();
  await bot.start();

  //var response = await bot.ask('My name is John');
  let conversation = [
    {
      role: 'user',
      content: 'My name is John',
    },
    {
      role: 'ai',
      content:
        'Hello John! How can I help you today? If you have any questions or need assistance, please feel free to ask.Hello John! How can I help you today? If you have any questions or need assistance, please feel free to ask.',
    },
    {
      role: 'user',
      content: 'What is my name?',
    },
  ];
  for (let i = 0; i < 20; i++) {
    console.log(i);
    let response = bot.send(conversation, 'gpt-4');
  }
})();
