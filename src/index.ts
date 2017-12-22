/* tslint:disable variable-name */
import { Callback, Context } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as path from "path";
import * as puppeteer from "puppeteer";

const bucket = process.env.BUCKET_NAME;

if (!bucket) {
  throw new Error("No bucket specified");
}

const s3Config = {
  apiVersion: "2006-03-01",
  region: "eu-west-1",
  bucket,
};
const puppeteerConfig = {
  headless: true,
  executablePath: path.join(__dirname, "..", "bin", "headless_shell.compiled"),
  args: ["--no-sandbox", "--single-process"],
};

const local = "LOCAL" in process.env;

function loadPage(page: puppeteer.Page, url: string) {
  let resolve: null | (() => void) = null;
  let requestCount = 0;
  let timer: NodeJS.Timer | null = null;

  function onPageLoaded() {
    // console.log('page loaded (hopefully)');
    if (resolve) {
      resolve();
    }
  }

  page.on("request", msg => {
    requestCount += 1;
    // console.log('request:', msg.url, requestCount);
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  });

  page.on("response", msg => {
    requestCount -= 1;
    // console.log('response:', msg.url, requestCount, '/', msg.status, '/', msg.ok);
    if (requestCount === 0) {
      timer = setTimeout(onPageLoaded, 5000);
    }
    if (requestCount < 0) {
      requestCount = 0;
    }
  });

  page.goto(url);

  return new Promise(r => {
    resolve = r;
  });
}

function uploadScreenshot(screenshot: Buffer, sandboxId: string) {
  if (local) {
    AWS.config.loadFromPath("./aws_sdk.json");
  }

  const S3 = new AWS.S3({
    apiVersion: s3Config.apiVersion,
    region: s3Config.region,
  });

  const uploadParams = {
    ACL: "public-read",
    Bucket: s3Config.bucket,
    Key: `${sandboxId}.png`,
    Body: screenshot,
    ContentType: "image/png",
  };

  return S3.upload(uploadParams).promise();
}

export async function handler(event: any, context: Context, cb: Callback) {
  /** Immediate response for WarmUP plugin */
  if (event.source === "serverless-plugin-warmup") {
    console.log("WarmUP - Lambda is warm!");
    return cb(undefined, "Lambda is warm!");
  }

  try {
    const sandboxId = event.sandboxId;

    const browser = await puppeteer.launch(puppeteerConfig);
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    await loadPage(page, `https://${sandboxId}.codesandbox.io/`);
    const screenshot = await page.screenshot();
    const res = await uploadScreenshot(screenshot, sandboxId);
    await browser.close();

    cb(undefined, res.Location);
  } catch (e) {
    cb(e);
  }
}

if (local) {
  exports.handler(
    { sandboxId: "vue" },
    {
      done: (err: any, data: any) => {
        console.log("response:", data);
      },
    },
  );
}
