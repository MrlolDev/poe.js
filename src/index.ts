import { scrape, getUpdatedSettings } from './utils/credentials.js';
import { listenWs, connectWs, disconnectWs } from './utils/websocket.js';
import * as mail from './utils/mail2.js';
import { readFileSync, writeFile } from 'fs';
import path from 'path';

//const gqlDir = './node_modules/quora-poe.js/graphql';
const gqlDir = './graphql';
type models = 'gpt-4' | 'chatgpt' | 'sage' | 'claude+' | 'claude' | 'dragonfly';
const queries = {
  chatViewQuery: readFileSync(path.join(gqlDir, 'ChatViewQuery.graphql'), 'utf8'),
  addMessageBreakMutation: readFileSync(path.join(gqlDir, '/AddMessageBreakMutation.graphql'), 'utf8'),
  chatPaginationQuery: readFileSync(path.join(gqlDir, '/ChatPaginationQuery.graphql'), 'utf8'),
  addHumanMessageMutation: readFileSync(path.join(gqlDir, '/AddHumanMessageMutation.graphql'), 'utf8'),
  loginMutation: readFileSync(path.join(gqlDir, '/LoginWithVerificationCodeMutation.graphql'), 'utf8'),
  signUpWithVerificationCodeMutation: readFileSync(
    path.join(gqlDir, '/SignupWithVerificationCodeMutation.graphql'),
    'utf8',
  ),
  sendVerificationCodeMutation: readFileSync(
    path.join(gqlDir, '/SendVerificationCodeForLoginMutation.graphql'),
    'utf8',
  ),
};

let [pbCookie, channelName, appSettings, formkey] = ['', '', '', ''];
export default class ChatBot {
  private headers = {
    'Content-Type': 'application/json',
    Accept: '*/*',
    Host: 'poe.com',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    Origin: 'https://poe.com',
  };

  private chatId: number = 0;
  private bot: string = '';
  private ws: any;
  private credentials: {
    quora_formkey: string;
    quora_cookie: string;
    channel_name: string;
    app_settings: any;
  } = {
    quora_formkey: '',
    quora_cookie: '',
    channel_name: '',
    app_settings: {},
  };

  public async start() {
    await this.setCredentials();
    await this.subscribe();
    await this.login();
    let { minSeq } = await getUpdatedSettings(channelName, pbCookie);
    this.credentials.app_settings.tchannelData.minSeq = minSeq;
    await this.subscribe();
    this.ws = await connectWs(this.credentials);
  }
  public async login() {
    const { email, token } = await mail.createNewEmail();
    const status = await this.sendVerifCode(email);
    const otp_code = await mail.getPoeOTPCode(token);
    if (status === 'user_with_confirmed_email_not_found') {
      await this.signUpWithVerificationCode(email, otp_code);
    } else {
      await this.signInOrUp(email, otp_code);
    }
  }
  public async ask(msg: string, model: models = 'gpt-4') {
    let formatModel;
    if (model === 'gpt-4') {
      formatModel = 'beaver';
    } else if (model === 'chatgpt') {
      formatModel = 'chinchilla';
    } else if (model === 'sage') {
      formatModel = 'capybara';
    } else if (model === 'claude+') {
      formatModel = 'a2_2';
    } else if (model === 'claude') {
      formatModel = 'a2';
    } else if (model === 'dragonfly') {
      formatModel = 'nutria';
    }

    await this.getChatId(formatModel);
    await this.sendMsg(msg);
    let res = await listenWs(this.ws);
    await disconnectWs(this.ws);
    return res;
  }
  public async send(messages: Array<{ role: 'AI' | 'User'; content: string }>, model: models = 'gpt-4') {
    var prompt = '';
    for (var i = 0; i < messages.length; i++) {
      if (i == messages.length - 1) {
        prompt += `${messages[i].role}: ${messages[i].content}\n`;
      } else {
        prompt += `${messages[i].role}: ${messages[i].content}`;
      }
    }
    var answer = await this.ask(prompt, model);
    return answer;
  }

  private async makeRequest(request) {
    this.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(request), 'utf8');

    const response = await fetch('https://poe.com/api/gql_POST', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request),
    });

    return await response.json();
  }
  private async getChatId(bot: string) {
    try {
      const {
        data: {
          chatOfBot: { chatId },
        },
      } = await this.makeRequest({
        query: `${queries.chatViewQuery}`,
        variables: {
          bot,
        },
      });
      this.chatId = chatId;
      this.bot = bot;
    } catch (e) {
      throw new Error(
        'Could not get chat id, invalid formkey or cookie! Please remove the quora_formkey value from the config.json file and try again.',
      );
    }
  }
  private async sendMsg(query: string) {
    try {
      await this.makeRequest({
        query: `${queries.addHumanMessageMutation}`,
        variables: {
          bot: this.bot,
          chatId: this.chatId,
          query: query,
          source: null,
          withChatBreak: false,
        },
      });
    } catch (e) {
      throw new Error('Could not send message');
    }
  }
  private async setCredentials() {
    let result = await scrape();
    this.credentials.quora_formkey = result.appSettings.formkey;
    this.credentials.quora_cookie = result.pbCookie;
    // For websocket later feature
    this.credentials.channel_name = result.channelName;
    this.credentials.app_settings = result.appSettings;

    // set value
    formkey = result.appSettings.formkey;
    pbCookie = result.pbCookie;
    // For websocket later feature
    channelName = result.channelName;
    appSettings = result.appSettings;
    this.headers['poe-formkey'] = formkey;
    this.headers['poe-tchannel'] = channelName;
    this.headers['Cookie'] = pbCookie;
  }

  private async subscribe() {
    const query = {
      queryName: 'subscriptionsMutation',
      variables: {
        subscriptions: [
          {
            subscriptionName: 'messageAdded',
            query:
              'subscription subscriptions_messageAdded_Subscription(\n  $chatId: BigInt!\n) {\n  messageAdded(chatId: $chatId) {\n    id\n    messageId\n    creationTime\n    state\n    ...ChatMessage_message\n    ...chatHelpers_isBotMessage\n  }\n}\n\nfragment ChatMessageDownvotedButton_message on Message {\n  ...MessageFeedbackReasonModal_message\n  ...MessageFeedbackOtherModal_message\n}\n\nfragment ChatMessageDropdownMenu_message on Message {\n  id\n  messageId\n  vote\n  text\n  ...chatHelpers_isBotMessage\n}\n\nfragment ChatMessageFeedbackButtons_message on Message {\n  id\n  messageId\n  vote\n  voteReason\n  ...ChatMessageDownvotedButton_message\n}\n\nfragment ChatMessageOverflowButton_message on Message {\n  text\n  ...ChatMessageDropdownMenu_message\n  ...chatHelpers_isBotMessage\n}\n\nfragment ChatMessageSuggestedReplies_SuggestedReplyButton_message on Message {\n  messageId\n}\n\nfragment ChatMessageSuggestedReplies_message on Message {\n  suggestedReplies\n  ...ChatMessageSuggestedReplies_SuggestedReplyButton_message\n}\n\nfragment ChatMessage_message on Message {\n  id\n  messageId\n  text\n  author\n  linkifiedText\n  state\n  ...ChatMessageSuggestedReplies_message\n  ...ChatMessageFeedbackButtons_message\n  ...ChatMessageOverflowButton_message\n  ...chatHelpers_isHumanMessage\n  ...chatHelpers_isBotMessage\n  ...chatHelpers_isChatBreak\n  ...chatHelpers_useTimeoutLevel\n  ...MarkdownLinkInner_message\n}\n\nfragment MarkdownLinkInner_message on Message {\n  messageId\n}\n\nfragment MessageFeedbackOtherModal_message on Message {\n  id\n  messageId\n}\n\nfragment MessageFeedbackReasonModal_message on Message {\n  id\n  messageId\n}\n\nfragment chatHelpers_isBotMessage on Message {\n  ...chatHelpers_isHumanMessage\n  ...chatHelpers_isChatBreak\n}\n\nfragment chatHelpers_isChatBreak on Message {\n  author\n}\n\nfragment chatHelpers_isHumanMessage on Message {\n  author\n}\n\nfragment chatHelpers_useTimeoutLevel on Message {\n  id\n  state\n  text\n  messageId\n}\n',
          },
          {
            subscriptionName: 'viewerStateUpdated',
            query:
              'subscription subscriptions_viewerStateUpdated_Subscription {\n  viewerStateUpdated {\n    id\n    ...ChatPageBotSwitcher_viewer\n  }\n}\n\nfragment BotHeader_bot on Bot {\n  displayName\n  ...BotImage_bot\n}\n\nfragment BotImage_bot on Bot {\n  profilePicture\n  displayName\n}\n\nfragment BotLink_bot on Bot {\n  displayName\n}\n\nfragment ChatPageBotSwitcher_viewer on Viewer {\n  availableBots {\n    id\n    ...BotLink_bot\n    ...BotHeader_bot\n  }\n}\n',
          },
        ],
      },
      query:
        'mutation subscriptionsMutation(\n  $subscriptions: [AutoSubscriptionQuery!]!\n) {\n  autoSubscribe(subscriptions: $subscriptions) {\n    viewer {\n      id\n    }\n  }\n}\n',
    };

    await this.makeRequest(query);
  }

  private async signInOrUp(email, verifyCode) {
    try {
      const {
        data: {
          loginWithVerificationCode: { status: loginStatus },
        },
      } = await this.makeRequest({
        query: `${queries.loginMutation}`,
        variables: {
          verificationCode: verifyCode,
          emailAddress: email,
        },
      });
      return loginStatus;
    } catch (e) {
      throw e;
    }
  }

  private async signUpWithVerificationCode(email, verifyCode) {
    try {
      const {
        data: {
          signupWithVerificationCode: { status: loginStatus },
        },
      } = await this.makeRequest({
        query: `${queries.signUpWithVerificationCodeMutation}`,
        variables: {
          verificationCode: verifyCode,
          emailAddress: email,
        },
      });
      return loginStatus;
    } catch (e) {
      throw e;
    }
  }

  private async sendVerifCode(email) {
    try {
      // status error case: success, user_with_confirmed_phone_number_not_found, user_with_confirmed_email_not_found
      let {
        data: {
          sendVerificationCode: { status },
        },
      } = await this.makeRequest({
        query: `${queries.sendVerificationCodeMutation}`,
        variables: {
          emailAddress: email,
          phoneNumber: null,
        },
      });
      return status;
    } catch (e) {
      throw e;
    }
  }
}
