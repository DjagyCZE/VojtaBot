import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import puppeteer from 'puppeteer';
import fs from 'fs';

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.CHANNEL_ID;
const usernameToWatch = "papajako";
const chatUrl = "https://www.gta-multiplayer.cz/cz/chat/";
const cookiesPath = "./cookies.json";

async function loginAndSaveCookies(browser) {
    const page = await browser.newPage();
    await page.goto(chatUrl, { waitUntil: 'networkidle2' });

    await page.waitForSelector('input[name="login_user"]');
    await page.type('input[name="login_user"]', process.env.SITE_USER);
    await page.type('input[name="login_password"]', process.env.SITE_PASS);

    await page.click('button.Button.PinkButton');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    console.log("🔐 Cookies uložené.");
    await page.close();
}

async function loadCookies(page) {
    if (!fs.existsSync(cookiesPath)) return;
    const cookies = JSON.parse(fs.readFileSync(cookiesPath));
    for (const cookie of cookies) {
        await page.setCookie(cookie);
    }
}

async function checkUserOnline(page, username) {
    await page.goto(chatUrl, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(1500);

    const text = await page.evaluate(() => document.body.innerText.toLowerCase());
    return text.includes(username.toLowerCase());
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once("ready", async () => {
    console.log(`Bot přihlášen jako ${client.user.tag}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
        ]
    });

    const page = await browser.newPage();

    if (!fs.existsSync(cookiesPath)) {
        console.log("🔐 První přihlášení...");
        await loginAndSaveCookies(browser);
    }

    await loadCookies(page);

    let lastState = false;

    setInterval(async () => {
        const isOnline = await checkUserOnline(page, usernameToWatch);

        if (isOnline && !lastState) {
            const ch = await client.channels.fetch(channelId);
            await ch.send(`🔔 Hráč **${usernameToWatch}** se právě připojil!`);
        }

        lastState = isOnline;
    }, parseInt(process.env.CHECK_INTERVAL_MS || "15000", 10));
});

client.login(token);