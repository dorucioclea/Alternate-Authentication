/*
 * Developer: Shivam Gangwar
 * Maintainer: Shivam Gangwar
 * Date: 19 Feb 2019
 */

const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const nodePersist = require("node-persist");

//just replace this call with our security algorithm
var crypto = require("crypto");

const path = require('path');

const TEST_BASE_DIR = path.join(__dirname, '/gdriveCred');


storage = nodePersist.create({
        dir: TEST_BASE_DIR,
        encoding: 'utf8',            
          expiredInterval: 2 * 60 * 1000, // every 2 minutes the process will clean-up the expired cache
          // in some cases, you (or some other service) might add non-valid storage files to your
          // storage dir, i.e. Google Drive, make this true if you'd like to ignore these files and not throw an error
          forgiveParseErrors: false
      });

//allow for variable storage --> security feature
storage.initSync();

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.appdata'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.


const TOKEN_PATH = 'token.json';


function downloadAllDomains(){
  return new Promise((resolve,reject) => {
    // Load client secrets from a local file.
    fs.readFile(__dirname + '/credentials.json', (err, content) => {
      if (err) reject(err);
      // Authorize a client with credentials, then call the Google Drive API.
      authorize(JSON.parse(content), downloadAllFilesFromTheGoogleDrive).then(downloadResult=>{
           resolve(downloadResult);
      }).catch(e =>{
           reject(e);
      });
    });
  });
}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
 function authorize(credentials, callback) {
   const { client_secret, client_id, redirect_uris } = credentials.installed;
   const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
   return new Promise((resolve,reject) => {
       // Check if we have previously stored a token.
       fs.readFile(__dirname + '/gdriveCred/'+TOKEN_PATH, (err, token) => {
         if (err){
           const authUrl = oAuth2Client.generateAuthUrl({
             access_type: 'offline',
             scope: SCOPES,
           });
           console.log('[ALERT] Authorize this app by visiting this url:', authUrl);
           const rl = readline.createInterface({
             input: process.stdin,
             output: process.stdout,
           });
           rl.question('\n[INPUT] Enter the code from that page here: ', (code) => {
             rl.close();
              oAuth2Client.getToken(code, (err, token) => {
               if (err) return console.error('Error retrieving access token', err);
               oAuth2Client.setCredentials(token);

               // Store the token to disk for later program executions
                 new Promise(function(res, rej){
                 fs.writeFile(__dirname + '/gdriveCred/'+TOKEN_PATH, JSON.stringify(token), (err) => {
                     if (err) rej(err);
                     else res();
                   });
                 }).then(function(oAuth2Client){
                       console.log("[SUCCESS] Token is stored at 'gdriveCred/token.json'");
                       //Calling main function where all the operations will be done.
                       callback(oAuth2Client).then(downloadResult=>{
                               resolve(downloadResult);
                       }).catch(e =>{
                            reject(e.message);
                       });
                 }).catch(function(err) {
                       reject(err);
                 });

             });
           });

         }
         else{
           oAuth2Client.setCredentials(JSON.parse(token));
           callback(oAuth2Client).then( downloadResult=>{
                resolve(downloadResult);
           }).catch(e =>{
                reject(e);
           });
         }
       });
     });
 }

function downloadAllFilesFromTheGoogleDrive(auth){
const drive = google.drive({ version: 'v3', auth});
return new Promise((resolve,reject) => {
  drive.files.list({
      spaces: 'appDataFolder',
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100
    }, function (err, res) {
        if (err) {
          console.error(err);
          reject(err);
        }else{
          let i = 0;
          for(let file of res.data.files) {

            if(file.name != '_init'){
            const dest = fs.createWriteStream(__dirname + '/gdriveCred/'+file.name);

            drive.files.get({
            spaces: 'appDataFolder',
            fileId: file.id,
            alt: 'media'
           },
            {responseType: 'stream'},
            function(err, res){
              res.data
                .on('end', () => {
                  dest.end();
                })
                .on('error', err => {
                  console.log('Error', err);
                })
                .pipe(dest);
            });
          }
        }
        resolve();
      }
  });
});

}

module.exports = {
  downloadAllDomains
}

