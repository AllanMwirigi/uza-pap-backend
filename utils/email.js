
const nodemailer = require('nodemailer');

const emailName = process.env.EMAIL_NAME;
const emailPass = process.env.EMAIL_PASS;
// const emailHost = environment.EMAIL_HOST;

const transporter = nodemailer.createTransport({
  // if gmail giving BadCredentials error or Invalid login, try allow less secure apps
  // and/or https://accounts.google.com/b/0/DisplayUnlockCaptcha

  service: 'gmail', 
  // host: emailHost,
  auth: {
    user: emailName,
    pass: emailPass,
  },
  tls: { rejectUnauthorized: false }
});

exports.sendEmail = async (subject, receipientEmail, htmlMsg) => {
  try {
    const mailOptions = {
      from: emailName, // sender address
      to: receipientEmail, // list of receivers
      subject, // Subject line
      html: htmlMsg // plain text body
    };
    transporter.sendMail(mailOptions, (err, /* info */) => {
      if (err) console.error(`email | ${err.message}`);
    });
  } catch (error) {
    console.error(`email | ${error.message}`);
  }
};