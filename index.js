const express = require("express");
const app = express();
require("dotenv").config();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const router = require('./router');

let originsList;
if (process.env.NODE_ENV === 'development') {
  originsList = ["http://localhost:4200"];
  app.use(morgan('dev'));
} else {
  originsList = []; // TODO: add prod url here
}
// set up cors
const corsOptions = {
  origin: originsList
  // optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/api/v1', router);

// any invalid endpoints that get past the above are handled here
app.use((req, res, next) => {
  if (res.headersSent) {
    // express handles the error if headers had already been sent and sth went wrong
    next();
    return;
  }
  res.sendStatus(404);
});

// custom error handling middleware i.e. for errors passed in next(error)
app.use((err, req, res, next) => {
  if (res.headersSent) {
    // express handles the error if headers had already been sent and sth went wrong
    next(err);
    return;
  }
  // set status to the status code of the error, otherwise 500 is default e.g. for db errors
  res.status(err.status || 500).json({ msg: err.message });
  // logger.error(`${err.status || 500} - ${req.method} ${req.url} - ${err.message}`);
  console.error(`${err.status || 500} - ${req.method} ${req.url} - ${err.message}`);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Payment server listening at http://localhost:${PORT} | environment: ${process.env.NODE_ENV}`)
);