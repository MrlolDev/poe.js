import fetch from 'cross-fetch';
import { readFileSync, writeFile } from 'fs';

const BASEURL = 'https://api.guerrillamail.com/ajax.php';

const createNewEmail = async () => {
  const response = await fetch(`${BASEURL}?f=get_email_address`);
  const response_json = await response.json();
  return {
    email: response_json.email_addr,
    token: response_json.sid_token,
    alias: response_json.alias,
    email_timestamp: response_json.email_timestamp,
  };
};

const getEmailList = async (sid_token) => {
  const response = await fetch(`${BASEURL}?f=get_email_list&offset=0&sid_token=${sid_token}`);
  const response_json = await response.json();
  return {
    list: response_json.list,
  };
};

const getLatestEmail = async (sid_token) => {
  let emailList = await getEmailList(sid_token);
  let emailListLength = emailList.list.length;
  while (true) {
    await new Promise((r) => setTimeout(r, 10000));
    emailList = await getEmailList(sid_token);
    emailListLength = emailList.list.length;
    if (emailListLength > 1) {
      break;
    }
  }

  return emailList.list[0];
};

const getPoeOTPCode = async (sid_token) => {
  const emailData = await getLatestEmail(sid_token);
  // Example email subject: "Your verification code 123456"
  return emailData.mail_subject.split(' ')[3];
};

export { createNewEmail, getEmailList, getLatestEmail, getPoeOTPCode };
