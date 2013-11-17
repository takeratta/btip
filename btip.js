var config = require('./config');
var logger = require('./lib/logger');
var Netmask = require('netmask').Netmask
var block = new Netmask(config.netmask);
var bitaddress = require('bitcoin-address');
var express = require('express');
var app = express();
var bitcoin = require('bitcoin');

var client = new bitcoin.Client({
  host: config.host,
  port: config.port,
  user: config.username,
  pass: config.password
});

app.use(express.bodyParser());
client.getBalance('*', 6, function (err, balance) {
  if (err) return console.log(err);
  app.post('/api', function (req, res) {
    if (block.contains(req.connection.remoteAddress)) {
      if (balance > 0) {
        var gitjson = JSON.parse(req.body.payload);
        if (gitjson.ref == 'refs/heads/' + config.branch) {
          logger.log('detected push to master');
          var regExp = /\(btip:([^)]+)\)/;
          var tipaddr = regExp.exec(gitjson.head_commit.message);
          if (bitaddress.validate(tipaddr[1])) {
            if (balance >= config.tip) {
              logger.log('Sending ' + config.tip + 'BTC to ' + tipaddr[1]);
              client.walletPassphrase(config.walletPassphrase, '1');
              client.sendToAddress(tipaddr[1], config.tip);
            }
            else
              logger.log('error', 'Failed send to: ' + tipaddr[1] + ' - Insufficient balance');
          }
          else
            logger.log('error', 'Failed send to: ' + tipaddr[1] + ' - Invalid address');
        }
      }
      else
        logger.log('error', 'No balance available');
    }
    else {
      logger.log('warn', 'Logged unauthorized request from IP: ' + req.connection.remoteAddress);
      res.send('IP Not authorized');
    }
    res.end('done');
  });

});

app.listen(3090);
logger.log('info', 'btip Listening on port 3090');
