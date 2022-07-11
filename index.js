const express = require("express")
const puppeteer = require("puppeteer")
const cron = require('node-cron')
const nodemailer = require('nodemailer')
const ehbs = require('nodemailer-express-handlebars')
const path = require('path')
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const { parse } = require("dotenv")
const { ppid } = require("process")
const exp = require("constants")
require('dotenv').config()
const users = require('./model/schema.js')

const app = express()

app.set('views', path.join(__dirname, '/views'));
app.use(bodyParser.urlencoded({extended:false}))
app.use(express.json())

//Connecting to mongoose
mongoose.connect(process.env.MONGO_URL, {useNewUrlParser: true})
.then(() => {
    console.log('DB connected')
})
.catch((err)=>{
    console.log(err);
})
app.get('/', (req, res)=>{
    res.render('index')
})

// Taking data from user
app.post('/', (req,res)=>{
    const userName = req.body.name;
    const userEmail = req.body.email;
    console.log(userName, " \n" + userEmail)
    const user = new users({
        name: userName,
        email: userEmail
    })
    user.save((err, doc)=>{
        if(!err)
        {
            res.redirect('./subscribed.html')
        }
        else
        {
            console.log('Error is: ' + err)
        }
    })
})

app.set('view engine', 'hbs');
app.use(express.static('public'))

cron.schedule(' 30 10 14 * *', async()=>{
    console.log('cron is working');
})

app.get('/', (req, res)=>{
    res.send("this is working")
});

var stockApi;

async function scrapeChannel(url){
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const [el] = await page.$x("/html/body/div/div/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[1]/a");
    const text = await el.getProperty("textContent");
    const stName = await text.jsonValue();

    const [el2] = await page.$x("/html/body/div/div/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[3]/text()");
                                 
    const priceSrc = await el2.getProperty("textContent");
    const priceVal = await priceSrc.jsonValue();

    const [el3] = await page.$x("/html/body/div/div/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[4]");
    const lowSrc = await el3.getProperty("textContent");
    const lowVal = await lowSrc.jsonValue();

    const [el4] = await page.$x("/html/body/div/div/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[5]");
    const highSrc = await el4.getProperty("textContent");
    const highVal = await highSrc.jsonValue();
                              
    const [el5] = await page.$x("/html/body/div/div/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[3]/div");
    const downBy = await el5.getProperty("textContent");
    const downVal = await downBy.jsonValue();

    

    let downValMod = downVal.replace(/\(.*?\)/gm, "");
    downValMod = downValMod.replace(/\+/g, "");
    downValMod = downValMod.replace(/\-/g, "");
    downValMod = downValMod.replace(/\,/g, "");
    let priceValMod = priceVal.replace(/\₹/g, "");
    priceValMod = priceValMod.replace(/\,/g, "");
    downValMod = parseFloat(downValMod);
    priceValMod = parseFloat(priceValMod);
    let pTemp = (downValMod/priceValMod)*100;
    let percentage = parseFloat(pTemp).toFixed(2);

    //getting users from database
    var mailList = []
    users.find({}, function(err, allUsers){
        if(err)
        {
            console.log(err)
        }
        allUsers.forEach(function(users){
            mailList.push(users.email);
            return mailList;
        });
    })




    if(percentage*100 > 500)
    {
        sendMail()
        function sendMail(){
            const mailTransporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.GID,
                    pass: process.env.GPW
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            const handlebarOptions = {
                viewEngine: {
                    extName: ".handlebars", 
                    partialDir: path.resolve('./views'),
                    defaultLayout: false
                },
                viewPath: path.resolve('./views'),
                extName: ".handlebars",
            }

            mailTransporter.use('compile', ehbs(handlebarOptions));

            let mailDetails = {
                from: process.env.GID,
                to: process.env.GTO,
                bcc: mailList,
                subject: `${stName} is down by ${percentage}%`,
                text: `Your stock ${stName} is down by ${downVal}, current price is${priceVal}, 52 week low price is ${lowVal}, while high value is ${highVal}`,
                template: 'email', 
                context: {
                    userName: 'Trader',
                    name: stName, 
                    percnt: percentage,
                    pVal: priceVal,
                    hVal: highVal,
                    lVal: lowVal 
                }
            };
        

        mailTransporter.sendMail(mailDetails, function(err, data){
            if(err){
                console.log('Error occur ' + err)
            }
            else{
                console.log('Email sent succesfully')
            }
        });
    }
}
    


    stockApi = {
        stocksName : stName,
        currentPrice : priceVal,
        lowPrice : lowVal,
        highPrice : highVal,
        downBy : downVal
    }
    //console.log(stockApi)
    browser.close();



}

scrapeChannel('https://groww.in/markets/top-losers?index=GIDXNIFTY100')


const port = process.env.PORT || 3000

app.listen(port, ()=>{
    console.log(`server started at port ${port}`)
})