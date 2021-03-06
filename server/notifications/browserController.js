const webPush = require('web-push');
const db = require('../db').pgPromise;

module.exports.sendBrowserNotifications = async (data) => {
  const { ownerId, guestId, thumbPath, sessionUploadCount } = data;

  try {
    const result = await db.task(async (t) => {
      const owner = await db.one(
        'SELECT first_name, guest_id FROM owners WHERE owner_id = $1',
        [ownerId]
      );
      const subscriptions = await db.any(
        'SELECT * FROM subscribers WHERE guest_id = ${guestId} AND browser IS NOT NULL',
        owner
      );
      return { owner, subscriptions };
    });
    if (result.subscriptions.length === 0) {
      return info('No browser subscriptions found.');
    }

    const payload = JSON.stringify({
      title: `${result.owner.firstName} just shared ${
        sessionUploadCount === 1 ? 'a' : sessionUploadCount
      } new photo${sessionUploadCount > 1 ? 's' : ''}!`,
      body: `Click to see ${sessionUploadCount === 1 ? 'it' : 'them'}!`,
      icon: thumbPath,
      guestId,
    });

    result.subscriptions.forEach((sub) => {
      const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
      const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

      webPush.setVapidDetails(
        'mailto:notification@carousel.jakepfaf.dev',
        publicVapidKey,
        privateVapidKey
      );

      webPush.sendNotification(sub.browser, payload).catch(async (error) => {
        console.error(error);
        // If 410 response (subscription no longer valid), remove from DB
        if (error.statusCode == 410) {
          console.log('Removing bad sub');
          try {
            const result = await db.task(async (t) => {
              const owner = await db.one(
                'SELECT username, guest_id FROM owners WHERE owner_id = $1',
                [ownerId]
              );
              const subscriptions = db.any(
                'SELECT * FROM subscribers WHERE guest_id = ${guestId} AND browser IS NOT NULL',
                owner
              );
              const deletedSub = db.one(
                "DELETE FROM subscribers WHERE browser -> 'keys'->>'auth' = ${browser.keys.auth} RETURNING *",
                sub
              );
              if (deletedSub)
                info('Removed bad browser sub from ' + owner.username);
              return { owner, subscriptions, deletedSub };
            });
          } catch (err) {
            error('Error removing bad browser subscription:', err);
          }
        }
      });

      return;
    });
    success('Browser notifications sent');
  } catch (err) {
    return error(err);
  }
};
