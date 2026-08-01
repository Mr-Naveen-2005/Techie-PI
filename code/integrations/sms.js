const Vonage = require('@vonage/server-sdk');
const { Channels } = require('@vonage/messages');

const vonage = new Vonage(
  {
    apiKey: "b226096c",
    apiSecret: "9M5YESBKEcigcWXL",
  }
);

vonage.message.sendSms(
  '916383877380',
  'Vonage APIs',
  'emerency alert',
  (err, responseData) => {
    if (err) {
      console.error(err);
    } else {
      console.log(responseData);
    }
  }
);