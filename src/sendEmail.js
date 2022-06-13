var nodemailer = require('nodemailer');
var database = require('./db');
/*
 * email send function (in )
 * details object there are all the information about the mail transfer
 * source address can be get from the common table in database
 */
function send (details, callback) {
    var user, pass, service;
    database.getCompanyMail(function (err, res) {
        if (err) return callback(err);
        user = res;
        service = res.substr(res.indexOf('@') + 1);
        service = service.substr(0, service.indexOf('.'));

        database.getCompanyPassword(function (err, result) {
            pass = result;

            // Create a SMTP transporter object
            var transporter = nodemailer.createTransport({
                // host: account.smtp.host,
                // port: account.smtp.port,
                // secure: account.smtp.secure,
                service: service,
                auth: {
                    user: user,
                    pass: pass
                }
            });

            // Message object
            var message = {
                to: details.to,
                subject: 'Support Message',
                html: details.html
            };

            transporter.sendMail(message, function(err, info){
                if (err) {
                    console.log('\n  Error occurred. ' + err.message);
                    return callback(err);
                }
                return callback(null);
            });
        });
    });
    // });
};


exports.sendDepositNotifyMail = function (param, callback) {
    var sms_title = 'MADABIT New Deposit';

    var html = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +

        '<html xmlns="http://www.w3.org/1999/xhtml">' +
        '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" />' +
        '<title>' + sms_title + '</title>' +
        '</head>' +
        '<body>' +
        '<h2>MADABIT NEW DEPOSIT</h2>' +
        '<br>' +
        'Coin Type : ' + param.cointype + '<br>' +
        'Amount : ' + param.amount + '<br>' +
        '</body></html>';

    database.getContactUsEmail(function(err, contact_us_email) {
        var details = {
            to: contact_us_email,
            from: 'support@madabit.com',
            subject: sms_title,
            html: html
        };
        return send(details, callback);
    });
};
