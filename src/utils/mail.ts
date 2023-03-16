import fetch from 'cross-fetch';
import { readFileSync, writeFile } from 'fs';
import { createInboxAsync, checkInboxAsync } from 'tempmail.lol';
const BASEURL = 'https://api.guerrillamail.com/ajax.php';
import delay from 'delay';
const createNewEmail = async () => {
  const response = await createInboxAsync();
  return {
    email: response.address,
    token: response.token,
  };
};

const getEmailList = async (token) => {
  const response = await checkInboxAsync(token);
  return response;
};

const getLatestEmail = async (token) => {
  await delay(5000);
  let emailList = await getEmailList(token);
  return emailList[0];
};

const getPoeOTPCode = async (token) => {
  const emailData = await getLatestEmail(token);
  return emailData.subject.split(' ')[3];
};

export { createNewEmail, getEmailList, getLatestEmail, getPoeOTPCode };
