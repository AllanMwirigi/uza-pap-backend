const User = require('./models/User');
const Asset = require('./models/Asset');

exports.registerUser = async (req, res, next) => {
  try {
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
    const user = await User.findOne({ email, password }).lean().exec();
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
    const assets = await Asset.find({}).lean().exec();
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

exports.addAsset = async (req, res, next) => {
  try {
    const asset = new Asset(req.body);
    const doc = await asset.save();
    res.status(201).json({ assetId: doc._id });
  } catch (error) {
    next(error);
  }
}

exports.purchaseAsset = async (req, res, next) => {
  try {
    const { userId, price } = req.body;
    // TODO: add the assetId to the user, and another field for custom price
    // TODO: or create new collection
  } catch (error) {
    next(error);
  }
}