const express = require("express");
const app = express();
require("dotenv").config();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const Agenda = require('agenda');
const http = require('http');
const router = require('./router');
const Daraja = require('./utils/Daraja');

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

app.use('/api/v1', router, emitPaymentStatus);

// any invalid endpoints that get past the above are handled here
app.use((req, res, next) => {
  if (res.headersSent) {
    // express handles the error if headers had already been sent and sth went wrong
    next();
    return;
  }
  res.status(404).json();
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

const connectionOptions = {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
};
mongoose
  .connect(process.env.DB_URL, connectionOptions)
  .then()
  .catch((err) => {
    if (err) console.error(`initial database connection error: ${err.message}`);
    else console.error(`initial database connection error`);
  });

const agenda = new Agenda({
  db: {
      address: process.env.DB_URL,
      options: {
        // useNewUrlParser: true,
        useUnifiedTopology: true
      }
  },
  processEvery: '30 seconds'
//   processEvery: '3 minutes'
});
agenda.on('error', err =>{ console.error(`Agenda | ${err.message}`) });

const server = http.createServer(app);

// connection successful
mongoose.connection.once('open', () => {
  console.log(`MongoDB Connected`);
  Daraja.initDaraja(agenda);
  // server starts listening only if connected to database
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () =>
    console.log(`Backend listening on http://localhost:${PORT} | environment: ${process.env.NODE_ENV}`)
  );
});

// connection throws an error
mongoose.connection.on('error', (err) => {
  if (err) console.error(`database connection error: ${err.message}`);
  else console.error(`database connection error`);
});
// connection is disconnected
mongoose.connection.on('disconnected', (err) => {
  if (err) {
    console.error(`database disconnected: ${err.message}`);
  }
  else console.error(`database disconnected`);
});

async function endAgendaGracefully() {
  await agenda.stop();
  process.exit(0);
}
process.on('SIGTERM', endAgendaGracefully);
process.on('SIGINT', endAgendaGracefully);

const socketio = require('socket.io')(server, {
  cors: {
    origin: originsList,
    // if using socket.io v3, then these two are needed; had to downgrade to v2.3 because ngx-socket-io client in Angular didn't seem to be comaptible, was giving 400 errors
    // methods: ["GET", "POST"],
    // credentials: true
  }
});

socketio.on('connection', (socket) => {
  
});

function emitPaymentStatus(req, res, next) {
  try {
    socketio.emit('payment', res.locals.sockdata);
  } catch (error) {
    next(error);
  }
}