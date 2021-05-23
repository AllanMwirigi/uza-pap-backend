const User = require('./models/User');
const Asset = require('./models/Asset');
const Purchase = require('./models/Purchase');
const Daraja = require('./utils/Daraja');
const nodecache = require('./utils/cache');
const { sendEmail } = require('./utils/email');

const PAYMENT_STATUS_FAILED = 0, PAYMENT_STATUS_SUCCESS = 1;
const KEY_ACCESS_TOKEN = "DarajaToken";

exports.registerUser = async (req, res, next) => {
  try {
    const { email } = req.body;
    let user = await User.findOne({ email }).lean().exec();
    if (user) {
      res.sendStatus(409);
      return;
    }
    user = new User(req.body);
    const doc = await user.save();
    res.status(201).json({ userId: doc._id });
  } catch (error) {
    next(error);
  }
}

exports.checkUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password }).select('-password').lean().exec();
    if (!user) {
      res.sendStatus(404);
      return;
    }
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

exports.getAllAssets = async (req, res, next) => {
  try {
    // const assets = await Asset.find({ purchased: { $exists: false } }).lean().exec();
    // res.status(200).json({ assets });
    const assets = await Asset.aggregate([
      { $match: { purchased: { $exists: false } }},
      { $group: { _id: "$category", assets: { $push: "$$ROOT" } } }
    ]).exec();
    res.status(200).json({ assets });
  } catch (error) {
    next(error);
  }
}

exports.getUserCatalogue = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const assets = await Asset.find({ userId }).lean().exec();
    res.status(200).json({ assets });
  } catch (error) {
    next(error);
  }
}

exports.saveAsset = async (req, res, next) => {
  try {
    const { assetId } = req.body;
    if (assetId == null) {
      const asset = new Asset(req.body);
      const doc = await asset.save();
      res.status(201).json({ assetId: doc._id });
    } else {
      await Asset.updateOne({ _id: assetId }, req.body).exec();
      res.status(200).json();
    }
  } catch (error) {
    next(error);
  }
}

exports.getUserPurchases = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const purchases = await Purchase.find({ userId, paymentStatus: PAYMENT_STATUS_SUCCESS }).select('asset amount timePaid')
      .populate('asset').lean().exec();
    res.status(200).json({ purchases });
  } catch(error) {
    next(error);
  }
}

exports.purchaseAsset = async (req, res, next) => {
  try {
    const { userId, assetId, phoneNo, price } = req.body;

    //TODO: send timestamp in request as it is sure to be local
    const timestamp = getTime();
    const { DARAJA_LIPA_NA_MPESA_SHORTCODE, DARAJA_LIPA_NA_MPESA_PASSKEY } = process.env;
    // const shortcode = process.env.DARAJA_SANDBOX_LIPA_NA_MPESA_SHORTCODE; // "174379";
    // const password = new Buffer(shortcode+"bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"+timestamp).toString("base64");
    // const password = Buffer.from(shortcode+"bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"+timestamp).toString('base64');
    const password = Buffer.from(DARAJA_LIPA_NA_MPESA_SHORTCODE + DARAJA_LIPA_NA_MPESA_PASSKEY + timestamp).toString('base64');

    let callBackUrl;
    if(process.env.NODE_ENV == 'development'){
        callBackUrl = "https://a5e75b21defb.ngrok.io/api/v1/assets/payment/notification";
    }
    else {
        callBackUrl = "https://uza-pap.herokuapp.com/api/v1/assets/payment/notification";
    }

    const data = {
       BusinessShortCode: DARAJA_LIPA_NA_MPESA_SHORTCODE,
       Password: password,
       Timestamp: timestamp,
       TransactionType: "CustomerPayBillOnline",
       Amount: "1", // will be amountPay in prod
       PartyA: phoneNo, 
       PartyB: DARAJA_LIPA_NA_MPESA_SHORTCODE,
       PhoneNumber: phoneNo,
       CallBackURL: callBackUrl,
       AccountReference: "UzaPap",
       TransactionDesc: "test"
    }

    let accessToken = nodecache.get(KEY_ACCESS_TOKEN);
    if(accessToken == undefined) {
      try {
        const response = await Daraja.generateAccessToken();
        accessToken = response.data.access_token;
        const iscached = nodecache.set(KEY_ACCESS_TOKEN, accessToken, 3300);
        if (iscached) console.debug(`Mpesa Access token generated and cached Payment | ${accessToken}`);
        else console.error(`Daraja Token not cached Payment`);
      } catch (error) {
        console.error(`Error generating access token | ${error.message}`);
        res.status(500).json();
        return;
      }
    }            
    Daraja.makePaymentRequest(accessToken, data)
    .then(async response =>{ 
      if(response.data.ResponseCode !== '0'){
          console.error('Mpesa error result code', response.data);
          res.status(500).json({message: 'Mpesa Error'});
          return;
      }
      const purchaseData = {
        userId, asset: assetId, amount: price,
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
      };
      try{
        const purchase = new Purchase(purchaseData);
        await purchase.save();
        res.status(201).json();
      }catch(error){
        res.status(500).json({success: false});
        console.error(`Save pendingMpesa | ${error.message}`);
      }
    })
    .catch(error=>{
      res.status(500).json({success: false});
      console.error(`Mpesa Error | ${error.message}`);
    });
  } catch (error) {
    next(error);
  }
}

exports.onReceivePaymentNotification = async (req, res, next) =>{
  try{
    res.sendStatus(200); 
    const paymentDetails = req.body;
    const resultCode = paymentDetails.Body.stkCallback.ResultCode;
    const merchantRequestId = paymentDetails.Body.stkCallback.MerchantRequestID;
    const checkoutRequestId = paymentDetails.Body.stkCallback.CheckoutRequestID;

    if(resultCode !== 0){ // payment request failed
      try{
        const doc = await Purchase.findOneAndUpdate({ checkoutRequestId, merchantRequestId }, 
          { paymentStatus: PAYMENT_STATUS_FAILED, mpesaResultCode: resultCode }
        ).select('userId').lean().exec();

        // to socket.io
        res.locals.sockdata = {
          userId: doc.userId, paymentStatus: PAYMENT_STATUS_FAILED,
        };
        next();
        console.error(`Mpesa Callback non-zero result code ${resultCode} - purchaseId ${doc._id}`);
      }catch(error){
        console.error(`Mpesa Callback non-zero result | DB | ${error.message}`);
      }
      return;
    }

    const timePaid = new Date().toISOString();
    const purchaseDoc = await Purchase.findOneAndUpdate({ checkoutRequestId, merchantRequestId }, 
      {paymentStatus: PAYMENT_STATUS_SUCCESS, timePaid, mpesaResultCode: resultCode }
    ).lean().exec();
    const assetDoc = await Asset.findOneAndUpdate( { _id: purchaseDoc.asset }, { purchased: true }).exec();

    // send email alert to seller // TODO: populate from assetDoc
    const seller = await User.findById(assetDoc.userId).lean().exec();
    const msg = `<p>Greetings, ${seller.firstName}</>
      <p>An item you posted (Name: ${assetDoc.name}) has been purchased for Ksh.${purchaseDoc.amount}</p>
      <p>The funds will be released to you upon delivery and approval of the item by the buyer</>
      <p>Thank you for your continued support</>
      <p>Regards, <br><b>UzaPap Team</b></p>`;
    sendEmail('UzaPap - Item Purchased', seller.email, msg);

    // update buyer via socket.io
    res.locals.sockdata = {
      userId: purchaseDoc.userId, paymentStatus: PAYMENT_STATUS_SUCCESS
    };
    next();
  } catch(error) {
    console.error(`Mpesa Callback | ${error.message}`);
  }
}

function getTime(){
  let date = new Date();
  let year = date.getFullYear().toString();
  let month = date.getMonth()+1;
  if(month < 10){
      month = '0'+month.toString();
  }else{
      month = month.toString();
  }
  let day = date.getDate();
  if(day < 10){
      day = '0'+day.toString();
  }else{
      day = day.toString();
  }
  let hour = date.getHours();
  if(hour < 10){
      hour = '0'+hour.toString();
  }else{
      hour = hour.toString();
  }
  let minute = date.getMinutes();
  if(minute < 10){
      minute = '0'+minute.toString();
  }else{
      minute = minute.toString();
  }
  let seconds = date.getSeconds();
  if(seconds < 10){
      seconds = '0'+seconds.toString();
  }else{
      seconds = seconds.toString();
  }
  return year+month+day+hour+minute+seconds;
}