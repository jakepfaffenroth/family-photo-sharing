const crypto = require('crypto');
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const webPush = require('web-push');
const db = require('../db').pgPromise;

const AWS = require('aws-sdk');
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
const sns = new AWS.SNS({ credentials: credentials, region: 'us-west-2' });
const ses = new AWS.SES({ credentials: credentials, region: 'us-west-2' });

const encrypt = (object) => {
  // convert object into string to be encrypted
  let text = JSON.stringify(object);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
};

const decrypt = (guest) => {
  try {
    let iv = Buffer.from(guest.iv, 'hex');
    let encryptedText = Buffer.from(guest.encryptedData, 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    // Convert the decrypted string back into an object
    return JSON.parse(decrypted.toString());
  } catch (err) {
    return;
  }
};

// Marks the user as a guest
module.exports.mark = async (req, res) => {
  // extracts guestId from path
  const guestId = req.path.split('/')[1];

  const owner = await db.oneOrNone(
    'SELECT guest_id FROM owners WHERE guest_id = $1',
    [guestId]
  );
  // Set guestId cookie on client
  if (owner) {
    res.cookie('guestId', owner.guestId, { maxAge: 1000 * 60 * 60 * 24 * 7 });
    res.redirect(process.env.CLIENT + '?guest=' + owner.guestId);
  } else {
    res
      .status(404)
      .end(
        '<div style="text-align: center;"><h1>404 - Not Found</h1> \n <h2>Invalid link</h2></div>'
      );
  }
};

// Sends guests subscription verification emails
module.exports.subscribeEmail = async (req, res) => {
  const { verifyEmailSender } = require('../tasks');
  const guest = req.body;

  try {
    const owner = await db.one(
      'SELECT * FROM owners WHERE guest_id = ${guestId}',
      guest
    );
    if (owner.length === 0) {
      return console.log('Incorrect guestId in email subscription.');
    }

    // First need to see if guest has already subscribed
    const email = await db.oneOrNone(
      'SELECT * FROM subscribers WHERE guest_id = ${guestId} AND email = ${email}',
      guest
    );
    if (email) {
      res.status(200).json({ alreadySubscribed: true });
    } else {
      verifyEmailSender.add({
        owner,
        guest,
      });
      res.end();
    }
  } catch (err) {
    error(err);
  }
};

module.exports.sendVerifyEmail = async (data) => {
  let { guest, owner } = data;
  // Handle form data if coming from invalid link re-subscribe page
  // if (req.body && !req.body.guest) {
  //   guest = req.body;
  // }
  if (guest.guest) {
    guest = guest.guest;
  }

  // Email not found in DB (guest hasn't subscribed yet)
  const sender = `Carousel Email Verification <notification@carousel.jakepfaf.dev>`;
  const recipient = guest.email;
  const subject = `Verify your subscription to ${owner.firstName}'s photos`;
  const queryParam = encodeURI(JSON.stringify(encrypt(guest)));
  const verifyLink = `${process.env.SERVER}/user/verify-email/?guest=${queryParam}&id=${guest.guestId}`;
  const body_text = 'Verify using this link: \n' + verifyLink;

  // The HTML body of the email.
  const body_html = `<html>
    <head></head>
    <body>
      <h1>Verify your subscription to ${owner.firstName}'s photos</h1>
      <p>Please verify your email subscription by clicking this link or pasting it into your browser:</p>
        <a href='${verifyLink}'>${verifyLink}</a>
    </body>
    </html>`;

  const charset = 'UTF-8';

  let params = {
    Source: sender,
    Destination: {
      ToAddresses: [recipient],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: charset,
      },
      Body: {
        Text: {
          Data: body_text,
          Charset: charset,
        },
        Html: {
          Data: body_html,
          Charset: charset,
        },
      },
    },
  };

  //Try to send the email.
  ses.sendEmail(params, function (err, data) {
    // If something goes wrong, print an error message.
    if (err) {
      error(err.message);
    } else {
      success('Verification email sent: Message ID: ', data.MessageId);
    }
  });

  // res.render('verificationEmailSent');
};

// Guests routed here after clicking verification link
// link query param decrypted into guest info object
// Updates the owner doc in DB with guest info
module.exports.verifyEmail = async (req, res, next) => {
  let guest = JSON.parse(req.query.guest);
  guest = decrypt(guest);
  // If decrypt fails (node probably restarted, or other link error) try subscribing again.
  if (!guest) {
    const gId = req.query.id;
    const subscribeLink = `${process.env.SERVER}/user/subscribe-email`;
    return res.status(418).render('verificationError', {
      guestId: gId,
      subscribeLink: subscribeLink,
    });
  }

  const subscriber = await db.oneOrNone(
    'SELECT * FROM subscribers WHERE email = ${email}',
    guest
  );

  if (subscriber) {
    res.status(200).send('Already verified email');
  }

  const newEmailSubscriber = await db.one(
    'INSERT INTO subscribers (guest_id, email, first_name, last_name) VALUES (${guestId}, ${email}, ${firstName}, ${lastName}) RETURNING *',
    guest
  );

  success(newEmailSubscriber.email + ' saved.');

  const guestLink = `${process.env.SERVER}/${guest.guestId}/guest`;

  res.status(200).render('emailVerified', { guestLink: guestLink });
};

module.exports.subscribeBrowser = async (req, res) => {
  const guest = req.body;
  const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
  const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

  webPush.setVapidDetails(
    'mailto:hello@jakepfaf.dev',
    publicVapidKey,
    privateVapidKey
  );

  guest.browser = JSON.parse(guest.browser);

  try {
    const subscription = await db.oneOrNone(
      "SELECT * FROM subscribers WHERE guest_id = ${guestId} AND browser -> 'keys' ->> 'auth' = ${browser.keys.auth}",
      guest
    );
    if (subscription) return res.status(200).json({ alreadySubscribed: true });
    else {
      (async function () {
        const newSub = await db.one(
          'INSERT INTO subscribers (guest_id, browser, first_name, last_name) VALUES (${guestId}, ${browser}, ${firstName}, ${lastName}) RETURNING browser',
          guest
        );
        success('New browser sub saved.');
        return res.status(200).send(newSub);
      })();
    }
  } catch (err) {
    return error(err);
  }
};

module.exports.getSubscribers = async (req, res) => {
  try {
    const subscribers = await db.any(
      'SELECT * FROM subscribers WHERE guest_id = (SELECT guest_id FROM owners WHERE owner_id = ${ownerId})',
      req.body
    );
    res.json(subscribers);
  } catch (err) {
    error(err);
  }
};
