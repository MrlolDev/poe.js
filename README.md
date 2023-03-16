# poe.js

A package to interact with poe.com.

## Installation

```bash
npm install poe.js
```

## Usage

Available models: gpt-4, chatgpt, sage, claude+, claude, dragonfly

One message:

```js
import Poe from 'poe.js';
(async () => {
  const bot = new Poe();
  await bot.start();
  let answer = await bot.ask('Hello!', 'gpt-4');
})();
```

Conversation:

```js
import Poe from 'poe.js';
(async () => {
  const bot = new Poe();
  await bot.start();
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
  ];
  let answer = await bot.send(conversation, 'gpt-4');
})();
```
