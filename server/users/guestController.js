const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const webPush = require('web-push');
const add = require('date-fns/add');
const toDate = require('date-fns/toDate');
const compareAsc = require('date-fns/compareAsc');
require('dotenv').config();
const db = require('../db').pgPromise;

const AWS = require('aws-sdk');
const { ForecastQueryService } = require('aws-sdk');
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

  const user = await db.oneOrNone('SELECT guest_id FROM users WHERE guest_id = $1', [guestId]);
  // Set guestId cookie on client
  if (user) {
    res.cookie('guestId', user.guestId, { maxAge: 1000 * 60 * 60 * 24 * 7 });
    res.redirect(process.env.CLIENT + '?guest=' + user.guestId);
  } else {
    res.status(404).end('<div style="text-align: center;"><h1>404 - Not Found</h1> \n <h2>Invalid link</h2></div>');
  }
};

// ---------------------------------------------------
// ------- Guest Subscription and Verification -------

// Sends guests subscription verification emails
module.exports.subscribeEmail = async (req, res) => {
  let guest = req.body.guest;

  // Handle form data if coming from invalid link re-subscribe page
  if (req.body && !req.body.guest) {
    guest = req.body;
  }

  console.log('guest: ', guest);
  const owner = await db.one('SELECT * FROM users WHERE guest_id = ${guestId}', guest);
  if (owner.length === 0) {
    return console.log('Incorrect ownerId in email subscription.');
  }
  console.log('owner: ', owner);

  // First need to see if guest has already subscribed
  const email = await db.oneOrNone(
    "SELECT * FROM subscribers WHERE owner_id = ${guestId} AND email ->> 'emailAddress' = ${email}",
    guest
  );
  if (email) {
    console.log('foundEmail', email.emailAddress);
    res.status(200).send('Already subscribed email');
  } else {
    // Email not found in DB (guest hasn't subscribed yet)
    const sender = `Carousel Email Verification <notification@carousel.jakepfaf.dev>`;
    const recipient = guest.email;
    const subject = `Verify your subscription to ${owner.firstName}'s photos`;
    const queryParam = encodeURI(JSON.stringify(encrypt(guest)));
    const verifyLink = `${process.env.SERVER}/guest/verify-email/?guest=${queryParam}&id=${guest.guestId}`;
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

    // The character encoding for the email.
    const charset = 'UTF-8';

    // Specify the parameters to pass to the API.
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
        console.log(err.message);
      } else {
        console.log('Email sent! Message ID: ', data.MessageId);
        console.log('data: ', data);
      }
    });

    res.status(200).render('verificationEmailSent');
  }
};

// Guests routed here after clicking verification link
// link query param decrypted into guest info object
// Updates the owner doc in DB with guest info
module.exports.verifyEmail = async (req, res, next) => {
  let guest = JSON.parse(req.query.guest);
  guest = decrypt(guest);
  // If decrypt fails (node probably restarted) try subscribing again.
  if (!guest) {
    const gId = req.query.id;
    const subscribeLink = `${process.env.SERVER}/guest/subscribe-email`;
    return res.status(418).render('verificationError', { guestId: gId, subscribeLink: subscribeLink });
  }

  const subscriber = await db.one("SELECT * FROM subscribers WHERE email ->> 'email_address' = ${email}", guest);

  if (subscriber) {
    console.log('foundEmail', subscriber.email);
    res.status(200).send('Already verified email');
  }

  const newEmailSubscriber = await db.one('INSERT INTO subscribers (owner_id, email) VALUES ($1, $2)RETURNING *', [
    guest.guestId,
    { firstName: guest.firstName, lastName: guest.lastName, emailAddress: guest.email },
  ]);

  console.log(newEmailSubscriber + ' saved.');

  const guestLink = `${process.env.SERVER}/${guest.guestId}/guest`;

  res.status(200).render('emailVerified', { guestLink: guestLink });
};

module.exports.subscribeBrowser = async (req, res) => {
  const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
  const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

  webPush.setVapidDetails('mailto:hello@jakepfaf.dev', publicVapidKey, privateVapidKey);

  const newSubscription = JSON.parse(req.body.subscription);
  const guestId = req.body.guestId;

  try {
    await db.task(async (t) => {
      const subscription = await t.one(
        "SELECT * FROM subscribers WHERE owner_id = $1 AND browser -> 'keys' ->> 'auth' = $2",
        [guestId, newSubscription.keys.auth]
      );
      if (subscription) return res.status(200).send('Already subscribed to browser notifications');
      else {
        (async function () {
          const newSub = await t.one('INSERT INTO subscribers (owner_id, browser) VALUES ($1, $2) RETURNING browser', [
            guestId,
            newSubscription,
          ]);
          console.log(newSub + ' saved.');
          return res.status(200).send(newSub);
        })();
      }
    });

    // // Save subscriptions info to owner doc in DB
    // // First need to see if guest has already subscribed
    // const subscription = await db.one(
    //   "SELECT * FROM subscribers WHERE owner_id = $1 AND browser -> 'keys' ->> 'auth' = $2",
    //   [guestId, newSubscription.keys.auth]
    // );
    // if (foundSub) {
    //   return res.status(200).send('Already subscribed to browser notifications');
    // }
  } catch (err) {
    return console.log(err);
  }
  // try {
  //   const subscription = await db.one('INSERT INTO subscribers (owner_id, browser) VALUES ($1, $2) RETURNING browser', [
  //     guestId,
  //     newSubscription,
  //   ]);

  //   if (subscription) {
  //     console.log(subscription + ' saved.');
  //   }

  //   res.status(200).send(subscription);
  // } catch (err) {
  //   console.log(err);
  // }
};

const updateTimestamp = async (guestId, timeStamp) => {
  try {
    const user = await db.one(
      'UPDATE users SET last_notification = $1 WHERE guest_id = $2 RETURNING last_notification',
      [timeStamp, guestId]
    );
  } catch (err) {
    console.log('Error:', err);
    return;
  }
};

// Send email notification
module.exports.emailNotification = async (req, res, next) => {
  // Get guestId out of url path
  const guestId = req.body.guestId;
  const timeStamp = toDate(Date.now()); // Convert numerical date to human-readable

  const user = await db.one('SELECT * FROM users WHERE guest_id = $1', [guestId]);

  // If last notification+1hr is later than the current timestamp,
  // timeComparison will equal 1 (else -1 or 0)
  const lastNotification = add(user.lastNotification, { hours: 1 });
  const timeComparison = compareAsc(lastNotification, timeStamp);

  // If less than one hour has passed since last notification, do not send another email
  if (timeComparison > 0) {
    console.log('\n🕑 Email notification sent within last hour\n');
    return res.end();
  }

  if (user) {
    await updateTimestamp(guestId, timeStamp);

    //  ---- CODE BELOW SENDS EMAILS
    const sender = `${user.firstName} ${user.lastName} (via Carousel) <notification@carousel.jakepfaf.dev>`;
    const subject = `New photo${res.locals.fileCount > 1 ? 's' : ''} shared!`;
    const body_text = `Go see ${res.locals.fileCount === 1 ? 'it' : 'them'}!` + req.body.shareUrl;
    const charset = 'UTF-8'; // The character encoding for the email.
    // The HTML body of the email.
    const body_html = `<html>
    <head></head>
    <body>
      <h1>${user.firstName} ${user.lastName} just shared ${
      res.locals.fileCount === 1 ? 'a' : res.locals.fileCount
    } new photo${res.locals.fileCount > 1 ? 's' : ''}!</h1>
      <p>Go see ${res.locals.fileCount === 1 ? 'it' : 'them'} here:</p>
        <a href='${process.env.SERVER}/${user.guest_id}/guest'>View Photo${res.locals.fileCount === 1 ? '' : 's'}</a>
        <img src=${res.locals.imgPath} />
    </body>
    </html>`;

    // Specify the parameters to pass to the API.
    let params = {
      Source: sender,
      Destination: {
        ToAddresses: [],
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

    // Get email subscribers and send email to each
    await db.each(
      'SELECT email FROM subscribers WHERE owner_id = ${guestId} AND email IS NOT NULL',
      req.body,
      (row) => {
        params.Destination.ToAddresses[0] = row.email.emailAddress;

        //Try to send the email.
        ses.sendEmail(params, function (err, data) {
          // If something goes wrong, print an error message.
          if (err) {
            console.log('err: ', err.message);
          } else {
            console.log('Email sent! Message ID: ', data.MessageId);
          }
        });
      }
    );
    // emailSubscribers.forEach((email) => {
    //   console.log(email);
    //   params.Destination.ToAddresses[0] = email.email.emailAddress;

    //   //Try to send the email.
    //   ses.sendEmail(params, function (err, data) {
    //     // If something goes wrong, print an error message.
    //     if (err) {
    //       console.log('err: ', err.message);
    //     } else {
    //       console.log('Email sent! Message ID: ', data.MessageId);
    //     }
    //   });
    // });
  }
  res.end();
};
