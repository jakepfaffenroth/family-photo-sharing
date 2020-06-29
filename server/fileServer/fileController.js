require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { Readable, Writable } = require('stream');
const sharp = require('sharp');
const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const multer = require('multer');

// let files = '/Users/Jake/Coding Projects/family-photos/local_file_storage/testFile.txt';
// let files = '/Users/Jake/Coding Projects/family-photos/local_file_storage/sunset.jpg';

const appKeyId = process.env.VUE_APP_APP_KEY_ID;
const applicationKey = process.env.VUE_APP_APPLICATION_KEY;
const bucketId = process.env.VUE_APP_BUCKET_ID;

const encodedBase64 = Buffer.from(appKeyId + ':' + applicationKey).toString('base64');

module.exports.b2Auth = (req, res, next) => {
  console.log('getting B2 credentials');
  let credentials;
  axios
    .post(
      `https://api.backblazeb2.com/b2api/v2/b2_authorize_account`,
      {},
      {
        headers: { Authorization: 'Basic ' + encodedBase64 },
      }
    )
    .then(function(response) {
      const data = response.data;
      credentials = {
        appKeyId: appKeyId,
        applicationKey: applicationKey,
        apiUrl: data.apiUrl,
        authorizationToken: data.authorizationToken,
        downloadUrl: data.downloadUrl,
        recommendedPartSize: data.recommendedPartSize,
      };
      res.locals.credentials = credentials;
      console.log('B2 credentials retrieved');
      next();
    })
    .catch(function(err) {
      console.log('err: ', err.response.data); // an error occurred
    });
};

module.exports.upload = (req, res, next) => {
  console.log('-------------------------');
  console.log('  STARTING IMAGE UPLOAD  ');
  console.log('-------------------------');
  console.log('Uploading', req.files.length, 'images');

  const credentials = res.locals.credentials;
  const files = req.files;

  const uploadImage = async (compressedImagePaths) => {
    await compressedImagePaths.forEach(async (imagePath) => {
      try {
        // Gets B2 auth token
        const authToken = await axios.post(
          credentials.apiUrl + '/b2api/v2/b2_get_upload_url',
          {
            bucketId: bucketId,
          },
          { headers: { Authorization: credentials.authorizationToken } }
        );
        let uploadUrl = authToken.data.uploadUrl;
        let uploadAuthorizationToken = authToken.data.authorizationToken;
        // Uploads images
        let source = fs.readFileSync(imagePath);
        let fileSize = fs.statSync(imagePath).size;
        let fileName = req.body.userId + '/' + path.basename(imagePath);
        fileName = encodeURI(fileName);
        let sha1 = crypto
          .createHash('sha1')
          .update(source)
          .digest('hex');

        const uploadResponse = await axios.post(uploadUrl, source, {
          headers: {
            Authorization: uploadAuthorizationToken,
            'X-Bz-File-Name': fileName,
            'Content-Type': 'b2/x-auto',
            'Content-Length': fileSize,
            'X-Bz-Content-Sha1': sha1,
            'X-Bz-Info-Author': 'unknown',
          },
        });

        // Delete temp file after successful upload
        fs.unlink(imagePath, (err) => {
          if (err) {
            throw err;
          }
          console.log('❌ Deleted ' + imagePath);
        });

        console.log(`✅ Status: ${uploadResponse.status} - ${uploadResponse.data.fileName} uploaded`);
      } catch (err) {
        console.log('⚠️ Error: ', err.response.data);
      }
    });
    // successful response
    res.status(200).json( `Success - ${compressedImagePaths} uploaded` );
  };

  // Compress image and save to temp folder
  (async () => {
    const compressedImagePaths = [];
    // Push the path of each uploaded file to an array
    const uploadsPaths = [];
    files.forEach((fileObject) => {
      uploadsPaths.push(fileObject.path);
    });

    // Compress the images
    const output = await imagemin(uploadsPaths, {
      destination: 'temp/compressed',
      plugins: [imageminMozjpeg()],
    });
    // Gets path of each compressed image and saves to an array
    output.forEach((compImage) => {
      let path = compImage.destinationPath;
      compressedImagePaths.push('./' + path);
    });
    uploadsPaths.forEach((path) => {
      fs.unlink(path, (err) => {
        if (err) {
          throw err;
        }
        console.log('❌ Deleted ' + path);
      });
    });

    console.log('✅ ' + output.length + ' images optimized');

    // Upload to B2, delete temp files
    try {
      await uploadImage(compressedImagePaths);
    } catch (err) {
      console.log('⚠️ Error in upload process: ', err);
    }
  })();
};

module.exports.listFiles = async (req, res, next) => {
  const apiUrl = res.locals.credentials.apiUrl;
  const authToken = res.locals.credentials.authorizationToken;
  const filePrefix = req.body.filePrefix;
  try {
    const response = await axios({
      method: 'POST',
      url: apiUrl + '/b2api/v2/b2_list_file_names',
      headers: {
        Authorization: authToken,
        'Content-Type': 'application/json; charset=utf-8',
      },
      data: {
        bucketId: bucketId,
        prefix: filePrefix + '/',
      },
    });

    res.json(response.data);
  } catch (err) {
    console.log('listFiles error: ', err);
  }
};

// TODO - Downloads corrupt file - encoding problem?
module.exports.download = async (req, res) => {
  const credentials = res.locals.credentials;
  const bucketName = process.env.VUE_APP_BUCKET_NAME;
  let fileName = path.basename(files);
  let saveToPath = '/Users/Jake/downloads/' + fileName;

  try {
    console.log('x', credentials.downloadUrl + '/file/' + bucketName + '/' + fileName);
    // GET image file from B2
    const downloadResponse = await axios.get(credentials.downloadUrl + '/file/' + bucketName + '/' + fileName, {
      headers: { Authorization: credentials.authorizationToken },
      responseType: 'stream',
    });
    // Write image file
    (function() {
      const source = new Readable();
      source._read = function noop() {};
      source.push(downloadResponse.data);
      source.push(null);

      const destination = fs.createWriteStream(saveToPath);

      source.on('end', function() {
        console.log('File successfully downloaded');
        res.send(`Success - ${fileName} downloaded`); // successful response
      });
      source.pipe(destination);
    })();
  } catch (err) {
    console.log(err); // an error occurred
  }
};

// TODO - file deletion
// TODO - list all files
// TODO - enable user to choose file with file picker