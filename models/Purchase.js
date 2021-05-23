const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// maybe should have pendingmpesa as not all purchases may use mpesa
const PurchaseSchema = new Schema({
  userId: { type: String, required: true, index: true },
  asset: { type: mongoose.Types.ObjectId, required: true },
  amount: { type: Number, required: true }, // might be different from the listed price of the asset
  merchantRequestId: {type: String}, // returned by MPESA
  checkoutRequestId: {type: String, required: true, index: true}, //  returned by MPESA
  mpesaResultCode: { type: Number }, //  returned by MPESA, 0 is success
  paymentStatus: { type: Number, default: -1 }, // 0 - failed, 1- successful, -1 - not processed
  timePaid: { type: String },
});

const Purchase = mongoose.model('Purchase', PurchaseSchema);
module.exports = Purchase;

// STK Push completed successfully
// {
//     MerchantRequestID: '30843-1600501-1',
//     CheckoutRequestID: 'ws_CO_170420201239014444',
//     ResponseCode: '0',
//     ResponseDescription: 'Success. Request accepted for processing',
//     CustomerMessage: 'Success. Request accepted for processing'
//   }

// Mpesa failed
// {
//     Body: {
//       stkCallback: {
//         MerchantRequestID: '30843-1600501-1',
//         CheckoutRequestID: 'ws_CO_170420201239014444',
//         ResultCode: 1037,
//         ResultDesc: 'DS timeout.'
//       }
//     }
//   }