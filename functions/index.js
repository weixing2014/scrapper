/* eslint-disable */
const puppeteer = require("puppeteer");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

exports.scrape = functions
    .runWith({
      timeoutSeconds: 300,
      memory: "2GB",
    })
    .region("us-central1")
    .https.onRequest(async (req, res) => {
      const price = await findPrice();
      res.type("html").send(`<br>${price}</br>`);
    });

async function sendEmail(currentPrice) {
  await admin.firestore().collection('emails').add({
    from: 'weixing1985@gmail.com',
    to: 'xing.wei@airbnb.com',
    headers: {
      headerKey: 'headerValue',
    },
    message: {
      subject: 'Your Amazon item just had a new price!',
      text: `The new price is ${currentPrice}`,
    },
  })
}

async function sendMsg(currentPrice) {
  await admin.firestore().collection('messages').add({
    to: '+15125548344',
    body: `Your Amazon item just had a new price $${currentPrice}!`
  });
}

const findPrice = async () => {
  const url = "https://www.amazon.com/LG-34UC88-B-34-Inch-21-UltraWide/dp/B07DPXJZJ9";

  const browser = await puppeteer.launch({
    headless: true,
    // devtools: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1920, height: 1080});
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.resourceType() == "font") {
      req.abort();
    } else {
      req.continue();
    }
  });
  await page.goto(url, {waitUntil: "networkidle2"});


  const currentPrice = await page.evaluate(() => {
    // disabled no-undef
    const currentPrice = document.querySelector(".apexPriceToPay > span")
        .innerText;
    return Number(currentPrice.replace("$", ""));
  });
  await browser.close();
  await db.collection("test").add({price: currentPrice, time: Date.now()});
  // await sendEmail(currentPrice);
  // await sendMsg(currentPrice);

  return currentPrice;
};


exports.priceTrackerCron = functions.runWith({
  memory: "2GB",
  timeoutSeconds: 300,
}).pubsub.schedule("every 120 minutes").onRun((context) => {
  return findPrice().then((currentPrice) => {
    console.log(`findPrice ${currentPrice} successfully at ${new Date().toLocaleTimeString()}`);
  });
});
