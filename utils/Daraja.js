const axios = require('axios');
const nodecache = require('./cache');

exports.generateAccessToken  = () =>{
  const consumer_key = process.env.DARAJA_SANDBOX_CONSUMER_KEY;
  const consumer_secret = process.env.DARAJA_SANDBOX_CONSUMER_SECRET;
  const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  // const auth = "Basic " + new Buffer(consumer_key + ":" + consumer_secret).toString("base64");
  const auth = "Basic " + Buffer.from(consumer_key + ":" + consumer_secret).toString('base64');

  const config = {
      headers: {
        'Authorization': auth
      }
  }
  return axios.get(url, config);
}

exports.initDaraja = (agenda) => {
  //   schedule a task to refresh Daraja API access token every 50min
  agenda.define('refreshDarajaToken', async (job, done) =>{
    const KEY_ACCESS_TOKEN = "DarajaToken";
    this.generateAccessToken().then(response =>{
        const accessToken = response.data.access_token;
      // token lives for 55min in cache, the 5min gap prevents expiry errors during payment requests
      // if auto generation fails, the hit to the payment endpoint generates and caches a new token
      // observe behaviour, could there be a problem if user tries to get while cron is setting
    
      const iscached = nodecache.set(KEY_ACCESS_TOKEN, accessToken, 3300);
      if (iscached) console.log(`Agenda - Mpesa Access token generated and cached | ${accessToken}`);
      else console.error(`Agenda - Daraja Token not cached`);
      done();    
    }).catch(error =>{
      console.error(`Agenda - Fetch Daraja token ${error.message}`);
      done();
    });
  });

  (async ()=>{
    agenda.on('ready', async()=>{
      await agenda.start();
      await agenda.every('50 minutes', 'refreshDarajaToken');
    });
  })();
}

exports.makePaymentRequest = (accessToken, data) => {
  const config = {
      headers: {
          'Accept': 'application/json',
          'Host': 'sandbox.safaricom.co.ke',
          'Authorization': 'Bearer '+ accessToken,
          'Content-Type': 'application/json'
      }
  }
  const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

  return axios.post(url, data, config);
}